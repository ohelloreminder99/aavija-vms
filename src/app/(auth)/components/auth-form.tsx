'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ShieldIcon, GoogleIcon } from '@/components/icons';
import { Eye, EyeOff, Loader2, Gift } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  createUserProfile,
  type UserProfile,
} from '@/services/user-service';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';
import { Separator } from '@/components/ui/separator';
import { Turnstile } from '@marsidev/react-turnstile';
import { createClient } from '@/lib/supabase/client';
import { applyReferralCode, ensureReferralCode } from '@/services/referral-service';

const formSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email({ message: 'Please enter a valid email.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long.' }),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }
  );

type UserFormValue = z.infer<typeof formSchema>;

interface AuthFormProps {
  mode: 'login' | 'signup';
}

export function AuthForm({ mode }: AuthFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams?.get('ref') || null;  // e.g. /signup?ref=ABC12345
  const { toast } = useToast();
  const supabase = createClient();

  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: UserFormValue) => {
    if (!captchaToken && process.env.NODE_ENV === 'production') {
      toast({
        variant: 'destructive',
        title: 'Verification Failed',
        description: 'Please wait for the security check to complete.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { checkAuthRateLimit } = await import('@/app/auth/actions');
      const rateCheck = await checkAuthRateLimit();
      if (!rateCheck.success) {
        throw new Error(rateCheck.error);
      }

      if (mode === 'signup') {
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            captchaToken: captchaToken || undefined,
            data: {
              full_name: data.name
            }
          }
        });

        if (error) throw error;
        const user = authData.user;
        if (!user) throw new Error("No user returned from signup");

        const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAIL && data.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

        // Use Supabase directly to create profiles instead of firestore
        if (isAdmin) {

          await supabase.from('users').insert({
            id: user.id,
            name: data.name || 'Admin',
            email: data.email,
            role: 'admin',
            is_verified: false,
            token_balance_visitor: 0,
            global_rating: 0,
            photo_url: '',
          });

          await supabase.from('logs').insert({
            actorId: user.id,
            actorName: data.name || 'Admin',
            actorRole: 'admin',
            action: LogAction.USER_SIGNUP,
            description: `New admin user "${data.name || 'Admin'}" (${data.email}) signed up.`
          });
        } else {
          const userName = data.name || 'Unnamed User';

          let startingTokens = 0;
          const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'global').single();
          if (settingsData) {
            startingTokens = settingsData.starting_token_visitor || 0;
          }

          await supabase.from('users').insert({
            id: user.id,
            name: userName,
            email: data.email,
            role: 'visitor',
            is_verified: false,
            token_balance_visitor: startingTokens,
            global_rating: 0,
            photo_url: '',
          });

          await supabase.from('logs').insert({
            actorId: user.id,
            actorName: userName,
            actorRole: 'visitor',
            action: LogAction.USER_SIGNUP,
            description: `New user "${userName}" (${data.email}) signed up as a visitor.`
          });

          if (startingTokens > 0) {
            await supabase.from('logs').insert({
              actorId: user.id,
              actorName: userName,
              actorRole: 'visitor',
              action: LogAction.INITIAL_TOKEN_ALLOCATION,
              description: `Welcome Bonus: Received ${startingTokens} tokens on signup.`,
              tokenChange: startingTokens,
            });
          }

          // Apply referral code if ?ref= was in the signup URL (non-fatal)
          if (refCode) {
            try {
              const refResult = await applyReferralCode(refCode, user.id);
              if (refResult.success && refResult.welcomeTokens && refResult.welcomeTokens > 0) {
                toast({
                  title: `🎁 Welcome Gift!`,
                  description: `${refResult.welcomeTokens} bonus tokens added because you joined via a referral.`,
                });
                // Log the referral welcome token credit
                void supabase.from('logs').insert({
                  actorId: user.id,
                  actorName: userName,
                  actorRole: 'visitor',
                  action: LogAction.REFERRAL_WELCOME_TOKENS,
                  description: `${userName} received ${refResult.welcomeTokens} bonus tokens for signing up via referral code "${refCode}".`,
                  tokenChange: refResult.welcomeTokens,
                });
              }
            } catch (refErr) {
              console.error('[Referral] Apply code failed at signup (non-fatal):', refErr);
            }
          }

          // Generate referral code for new user so they can share immediately (non-fatal)
          try {
            await ensureReferralCode();
          } catch (codeErr) {
            console.error('[Referral] Code generation failed (non-fatal):', codeErr);
          }
        }


        toast({
          title: 'Account Created',
          description: "We've sent a verification link to your email.",
        });

        router.push('/verify-email');
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
          options: {
            captchaToken: captchaToken || undefined,
          }
        });

        if (error) throw error;
        const user = authData.user;

        // Post-login actions that should not fail the entire login flow
        try {
          const { data: userProfile } = await supabase.from('users').select('*').eq('id', user.id).single();

          if (userProfile) {
            await supabase.from('logs').insert({
              actorId: user.id,
              actorName: userProfile.name,
              actorRole: userProfile.role,
              action: LogAction.USER_LOGIN,
              description: `User "${userProfile.name}" (${userProfile.email}) logged in.`
            });
          }
        } catch (logError) {
          // Log the error to the console for debugging, but don't show a user-facing error toast.
          console.error("Failed to complete post-login actions:", logError);
        }

        toast({
          title: 'Login Successful',
          description: 'Welcome back!',
        });
      }
    } catch (error: any) {
      console.error('Authentication Error:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      switch (error.message) {
        case 'User already registered':
          errorMessage =
            'This email is already in use. Please try another one.';
          break;
        case 'Invalid login credentials':
          errorMessage = 'Invalid email or password. Please try again.';
          break;
        default:
          errorMessage = error.message;
          break;
      }
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Pass ref= through the OAuth roundtrip so /auth/callback can apply it
          redirectTo: `${window.location.origin}/auth/callback${refCode ? `?ref=${refCode}` : ''}`,
          queryParams: {
            prompt: 'select_account',
            ...(captchaToken ? { captchaToken } : {})
          },
        }
      });
      // The redirect happens automatically here, we don't need to do the user profile creation
      // immediately since it involves a page reload. We would normally handle this in the auth callback.
      // But for the scope of this file rewrite, we'll just handle the error state.

      if (error) throw error;

    } catch (error: any) {
      console.error('Google Auth Error:', error);
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: error.message || 'Could not sign in with Google.',
      });
      setIsLoading(false);
    }
  };

  const pageTitle = mode === 'login' ? 'Login' : 'Create Visitor Account';
  const pageDescription = mode === 'login'
    ? 'Enter your email to log into your account'
    : 'Enter your details to create your account';
  const buttonText = mode === 'login' ? 'Login' : 'Create Visitor Account';

  // Show referral banner at top of signup form if ?ref= is present
  const referralBanner = mode === 'signup' && refCode ? (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400 mb-2">
      <Gift className="h-4 w-4 shrink-0" />
      <span>You were invited! Bonus tokens will be added after signup.</span>
    </div>
  ) : null;
  const alternativeActionText =
    mode === 'login' ? (
      <>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </>
    ) : (
      <>
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Login
        </Link>
      </>
    );

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <ShieldIcon className="mx-auto h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-white">{pageTitle}</h1>
        <p className="text-sm text-gray-400">{pageDescription}</p>
      </div>
      <div className="grid gap-6 pt-6">
        {referralBanner}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {mode === 'signup' && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your Name"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Your Password"
                        disabled={isLoading}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === 'signup' && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm Your Password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {mode === 'login' && (
              <div className="text-sm">
                <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            <div className="flex justify-center my-2">
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={(token) => setCaptchaToken(token)}
              />
            </div>

            <Button disabled={isLoading} className="w-full mt-6" type="submit">
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {buttonText}
            </Button>
          </form>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          disabled={isLoading}
          onClick={handleGoogleSignIn}
          className="w-full text-white"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-4 w-4" />
          )}
          Google
        </Button>

        <p className="px-8 text-center text-sm text-gray-400">
          {alternativeActionText}
        </p>
      </div>
    </>
  );
}
