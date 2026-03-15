'use client';

import * as React from 'react';
import Script from 'next/script';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Coins,
  Loader2,
  IndianRupee,
  DollarSign,
  Euro,
  PoundSterling,
  JapaneseYen,
  ShieldCheck,
  AlertCircle,
  FileText,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/services/settings-service';
import { useUserProfile } from '@/services/user-service';
import { useUser, useDoc } from '@/supabase';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { purchaseTokens } from '@/services/token-service';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '@/services/payment-service';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { Premise } from '@/services/premise-service';
import { createClient } from '@/lib/supabase/client';

const buyTokensSchema = z.object({
  quantity: z.coerce
    .number()
    .int()
    .min(1, 'You must purchase at least 1 token.'),
});

type BuyTokensFormValues = z.infer<typeof buyTokensSchema>;

interface BuyTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: 'visitor' | 'owner';
  premiseId?: string;
}

const currencyIcons: { [key: string]: React.ElementType } = {
  INR: IndianRupee,
  USD: DollarSign,
  EUR: Euro,
  GBP: PoundSterling,
  JPY: JapaneseYen,
  AUD: DollarSign,
  CAD: DollarSign,
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BuyTokensDialog({ open, onOpenChange, role, premiseId }: BuyTokensDialogProps) {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: settings, isLoading: settingsLoading } = useSettings();

  const docRef = React.useMemo(() => {
    if (!premiseId || role !== 'owner') return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId, role]);

  const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(docRef);

  const { toast } = useToast();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setStep(1);
    }
  }, [open]);

  const form = useForm<BuyTokensFormValues>({
    resolver: zodResolver(buyTokensSchema),
    defaultValues: {
      quantity: role === 'owner' ? 1000 : 100,
    },
  });

  const quantity = form.watch('quantity');

  const exchangeRate = settings?.token_exchange_rate || 0;
  const gstRate = (settings?.gst_rate || 0) / 100;
  const currency = settings?.currency || 'INR';
  const CurrencyIcon = currencyIcons[currency] || Coins;

  const subtotal = quantity * exchangeRate;
  const gstAmount = subtotal * gstRate;
  const totalPayable = subtotal + gstAmount;
  const totalInPaise = Math.round(totalPayable * 100);

  // Check for missing GST details
  const isGstMissing = React.useMemo(() => {
    const target = role === 'owner' ? premise : userProfile;
    if (!target) return false;
    return !target.legalName || !target.billingAddress || !target.billingState;
  }, [role, premise, userProfile]);

  const handlePayment = async (data: BuyTokensFormValues) => {
    if (!user || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'User profile not found.' });
      return;
    }
    if (role === 'owner' && !premiseId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Premise ID is missing for owner token purchase.' });
      return;
    }
    // Step 1 gating - transition to Step 2 instead of payment
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      const orderResult = await createRazorpayOrder({
        amount: totalInPaise,
        currency,
        appCheckToken: '',
      });

      if (!orderResult.success || !orderResult.order) {
        throw new Error(orderResult.error || 'Could not create payment order.');
      }

      const { order } = orderResult;

      // Clean concatenation of phone number for Razorpay
      const cleanCountryCode = (userProfile.countryCode || '+91').replace(/\D/g, '');
      const cleanPhone = (userProfile.phone || '').replace(/\D/g, '');
      const fullContact = cleanPhone.startsWith(cleanCountryCode) ? cleanPhone : `${cleanCountryCode}${cleanPhone}`;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Aavija Tokens',
        description: `Purchase of ${data.quantity.toLocaleString()} tokens`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            setIsSubmitting(true);
            const purchaseResult = await purchaseTokens({
              userId: user.id,
              tokenAmount: data.quantity,
              totalCost: totalPayable,
              currency: currency,
              actorName: userProfile.name,
              actorRole: userProfile.role,
              roleToCredit: role,
              premiseId: premiseId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (purchaseResult.success) {
              toast({
                title: 'Purchase Successful!',
                description: `${data.quantity.toLocaleString()} tokens added. Check "Token History & Invoices" for your bill.`,
              });
              onOpenChange(false);
              form.reset();
            } else {
              throw new Error(purchaseResult.error);
            }
          } catch (handlerError: any) {
            console.error("Payment Fulfillment Error:", handlerError);
            toast({
              variant: 'destructive',
              title: 'Credit Failed',
              description: handlerError.message || 'Tokens could not be credited. Please contact support.',
            });
          } finally {
            setIsSubmitting(false);
          }
        },
        prefill: {
          name: userProfile.name,
          email: userProfile.email,
          contact: fullContact,
        },
        theme: {
          color: '#3399cc',
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
          },
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Initialization Failed', description: error.message || 'An unexpected error occurred.' });
      setIsSubmitting(false);
    }
  };

  const guidanceText = role === 'owner'
    ? 'Owners often buy in bulk (e.g., 1000+) to manage premise check-in costs efficiently.'
    : 'Visitors typically buy smaller amounts (e.g., 100-500) to cover their check-ins.';

  const gstUpdateHref = role === 'owner'
    ? `/dashboard/owner/gst-details?premiseId=${premiseId}`
    : '/dashboard/visitor/gst-details';

  return (
    <>
      <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js" />
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        <DialogContent 
           onOpenAutoFocus={(e) => e.preventDefault()} 
           className="bg-[#020617]/95 border-white/10 backdrop-blur-3xl shadow-2xl max-w-md p-0 overflow-hidden rounded-2xl"
        >
          <DialogHeader className="p-6 border-b border-white/5 bg-[#020617]/40 relative">
            <div className="flex items-center gap-2">
              {step === 2 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 -ml-2 text-zinc-400 hover:text-white"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">
                {step === 1 ? 'Select' : 'Review'} <span className="text-primary/60">Tokens</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-xs uppercase font-bold tracking-widest mt-1">
              {step === 1 ? 'How many tokens would you like to buy?' : 'Review your order details before payment.'}
            </DialogDescription>
          </DialogHeader>

          {isGstMissing && !settingsLoading && !isPremiseLoading ? (
            <div className="space-y-4 p-6">
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold tracking-tight text-sm">Billing Details Required</AlertTitle>
                <AlertDescription className="text-sm opacity-90">
                  Per our Terms and Conditions, you must provide your Legal Name and Billing Address before purchasing tokens.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full bg-primary hover:opacity-90 transition-opacity rounded-xl h-11 text-xs font-black uppercase tracking-widest">
                <Link href={gstUpdateHref}>
                  <FileText className="mr-2 h-4 w-4" />
                  Update Billing Details
                </Link>
              </Button>
              <DialogFooter className="pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" className="w-full text-zinc-500 hover:text-white hover:bg-white/5 text-xs font-bold uppercase tracking-widest">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePayment)} className="p-0">
                <div className="p-6 space-y-6">
                  {step === 1 ? (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Token Quantity</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="e.g., 1000"
                                  {...field}
                                  disabled={isSubmitting}
                                  className="bg-black/40 border-white/5 text-white h-12 text-lg font-bold focus:ring-primary/50 pl-4"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (quantity > 0) setStep(2);
                                    }
                                  }}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-xs uppercase tracking-widest">Tokens</div>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs text-red-500/80 font-bold uppercase tracking-tight ml-1" />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <p className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Quick Select</p>
                        <div className="grid grid-cols-4 gap-2">
                          {[100, 200, 500, 1000].map((val) => (
                            <Button
                              key={val}
                              type="button"
                              variant="outline"
                              className={cn(
                                "h-10 border-white/5 bg-white/5 hover:bg-primary/20 hover:border-primary/50 text-xs font-bold transition-all text-white",
                                quantity === val ? "border-primary bg-primary/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "text-white/70"
                              )}
                              onClick={() => form.setValue('quantity', val)}
                            >
                              {val}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500 italic leading-relaxed">
                        {guidanceText}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {settingsLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                      ) : (
                        <div className="space-y-4 rounded-2xl border border-white/5 p-5 bg-[#020617]/95 backdrop-blur-3xl/[0.03]">
                          <h4 className="font-bold text-white text-xs uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Price Summary
                          </h4>
                          <Separator className="bg-white/5" />
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm text-zinc-400 font-medium">
                              <span>{quantity.toLocaleString()} Tokens x {exchangeRate.toFixed(2)} {currency}</span>
                              <span className="text-white font-bold">{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-zinc-400 font-medium">
                              <span>GST ({(gstRate * 100).toFixed(1)}%)</span>
                              <span className="text-zinc-500 font-bold">+ {gstAmount.toFixed(2)}</span>
                            </div>
                          </div>
                          <Separator className="bg-white/5" />
                          <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                            <span className="text-xs font-black uppercase tracking-widest text-primary/80">Total Payable</span>
                            <span className="flex items-center gap-1.5 text-2xl font-headline font-black text-white tracking-tighter">
                              <CurrencyIcon className="h-6 w-6 text-primary" />{' '}
                              {totalPayable.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 text-center italic leading-relaxed px-4 pt-2">
                            Securely processed via Razorpay. Convenience fees may apply.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="bg-[#020617]/40 p-6 border-t border-white/5 gap-3">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" disabled={isSubmitting} className="flex-1 text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-black uppercase h-12">
                      Cancel
                    </Button>
                  </DialogClose>
                  
                  {step === 1 ? (
                    <Button 
                      type="submit" 
                      disabled={quantity <= 0}
                      className="flex-[2] bg-primary hover:opacity-90 transition-opacity text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || quantity <= 0} 
                      className="flex-[2] bg-primary hover:opacity-90 transition-opacity text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl shadow-[0_5px_20px_rgba(59,130,246,0.3)]"
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                      )}
                      Pay Now
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

