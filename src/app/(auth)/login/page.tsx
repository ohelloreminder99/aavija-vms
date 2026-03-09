'use client';
import { AuthForm } from '../components/auth-form';
import { useUser } from '@/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ArrowUpRightFromSquare, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { Suspense } from 'react';

function LoginContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  // While checking auth state, show a loader.
  if (isUserLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If a user is found, a redirect is in progress. Render nothing to prevent flashing.
  if (user) {
    return null;
  }

  return (
    <>
      {errorParam === 'merge_account' && (
        <Alert variant="destructive" className="mb-6 border-destructive/50 bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account Exists</AlertTitle>
          <AlertDescription>
            You already have an account with these credentials. Please sign in with your password to merge your Google profile.
          </AlertDescription>
        </Alert>
      )}

      <AuthForm mode="login" />

      <div className="mt-8">
        <Separator />
        <div className="space-y-4 text-center mt-8">
          <h2 className="text-lg font-semibold">Get the Full Aavija Experience</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Install the Aavija app for the best experience. Enjoy faster access, offline capabilities, and a seamless native feel, just like a regular app.
          </p>
          <div className="text-left text-sm p-4 border rounded-lg bg-muted/50 space-y-4">

            <p className="font-semibold text-foreground text-center">
              How to Install
            </p>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs mt-0.5 shrink-0">1</div>
              <div>
                <strong>Windows, Mac, &amp; Linux Desktop:</strong> Click the "Install App" button located in the header at the top-right of this page. You may also see an install icon in your browser's address bar.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs mt-0.5 shrink-0">2</div>
              <div>
                <strong>Android:</strong> Tap the "Install App" button in the header or select "Add to Home Screen" from your browser's menu.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs mt-0.5 shrink-0">3</div>
              <div>
                <strong>iOS (iPhone/iPad):</strong> Tap the "Share" icon <ArrowUpRightFromSquare className="inline-block h-4 w-4 text-muted-foreground" /> in Safari's toolbar, then find and tap "Add to Home Screen".
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

