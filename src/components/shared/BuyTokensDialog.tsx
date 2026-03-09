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
} from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} >
          <DialogHeader>
            <DialogTitle>Buy More Tokens</DialogTitle>
            <DialogDescription>
              Enter the number of tokens you wish to purchase for your {role} balance.
            </DialogDescription>
          </DialogHeader>

          {isGstMissing && !settingsLoading && !isPremiseLoading ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Billing Details Required</AlertTitle>
                <AlertDescription>
                  Per our Terms and Conditions, you must provide your Legal Name and Billing Address before purchasing tokens. This is required for tax invoice generation.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href={gstUpdateHref}>
                  <FileText className="mr-2 h-4 w-4" />
                  Update GST & Billing Details
                </Link>
              </Button>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" className="w-full">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePayment)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 1000"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="pt-1 text-xs text-muted-foreground">
                        {guidanceText}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {settingsLoading ? (
                  <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  quantity > 0 && (
                    <div className="space-y-3 rounded-lg border p-4 text-sm bg-muted/20">
                      <h4 className="font-medium flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Price Summary
                      </h4>
                      <Separator />
                      <div className="flex justify-between">
                        <span>
                          {quantity.toLocaleString()} Tokens x{' '}
                          {exchangeRate.toFixed(2)} {currency}
                        </span>
                        <span>{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>GST ({(gstRate * 100).toFixed(1)}%)</span>
                        <span>+ {gstAmount.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Total Payable</span>
                        <span className="flex items-center gap-1">
                          <CurrencyIcon className="h-4 w-4" />{' '}
                          {totalPayable.toFixed(2)} {currency}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground text-center italic">
                        Note: Final payment processing and any applicable convenience fees are handled securely by the Razorpay Payment Gateway.
                      </p>
                    </div>
                  )
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting || quantity <= 0}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Proceed to Pay
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

