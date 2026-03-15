'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, CreditCard, Box, ArrowLeft } from 'lucide-react';
import { useSettings, clearSettingsCache } from '@/services/settings-service';
import { updateSettingsAction } from '../token-settings/actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const serviceSettingsSchema = z.object({
  whatsapp_phone_number_id: z.string().optional().or(z.literal('')),
  wa_template_host_notified: z.string().min(1),
  wa_template_phone_verify: z.string().min(1),
  wa_template_payout_approved: z.string().min(1),
  wa_template_payout_rejected: z.string().min(1),
  wa_template_kyc_verified: z.string().min(1),
  wa_template_tokens_converted: z.string().min(1),
  wa_template_referral_commission: z.string().min(1),
  wa_template_threshold_reached: z.string().min(1),
  wa_template_agent_assigned: z.string().min(1),
  razorpay_key_id: z.string().optional().or(z.literal('')),
});

type ServiceSettingsFormValues = z.infer<typeof serviceSettingsSchema>;

export default function ServiceSettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();

  const form = useForm<ServiceSettingsFormValues>({
    resolver: zodResolver(serviceSettingsSchema),
    defaultValues: {
      whatsapp_phone_number_id: '',
      wa_template_host_notified: 'aavija_host_notified',
      wa_template_payout_approved: 'aavija_payout_approved',
      wa_template_payout_rejected: 'aavija_payout_rejected',
      wa_template_kyc_verified: 'aavija_kyc_verified',
      wa_template_tokens_converted: 'aavija_tokens_converted',
      wa_template_referral_commission: 'aavija_referral_commission',
      wa_template_threshold_reached: 'aavija_threshold_reached',
      wa_template_phone_verify: 'aavija_phone_verify',
      wa_template_agent_assigned: 'aavija_agent_assigned',
      razorpay_key_id: '',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id || '',
        wa_template_host_notified: settings.wa_template_host_notified || 'aavija_host_notified',
        wa_template_phone_verify: settings.wa_template_phone_verify || 'aavija_phone_verify',
        wa_template_payout_approved: settings.wa_template_payout_approved || 'aavija_payout_approved',
        wa_template_payout_rejected: settings.wa_template_payout_rejected || 'aavija_payout_rejected',
        wa_template_kyc_verified: settings.wa_template_kyc_verified || 'aavija_kyc_verified',
        wa_template_tokens_converted: settings.wa_template_tokens_converted || 'aavija_tokens_converted',
        wa_template_referral_commission: settings.wa_template_referral_commission || 'aavija_referral_commission',
        wa_template_threshold_reached: settings.wa_template_threshold_reached || 'aavija_threshold_reached',
        wa_template_agent_assigned: settings.wa_template_agent_assigned || 'aavija_agent_assigned',
        razorpay_key_id: settings.razorpay_key_id || '',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: ServiceSettingsFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction(data);
      if (!result.success) throw new Error(result.error);
      
      clearSettingsCache();
      toast({ title: 'Success', description: 'Service configurations updated successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to update settings.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container flex justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline mb-2">Service Configuration</h1>
          <p className="text-zinc-500">Manage third-party API integration and message templates.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* WhatsApp Section */}
            <Card className="glass-card border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <MessageSquare className="h-5 w-5" />
                  WhatsApp Cloud API
                </CardTitle>
                <CardDescription>Setup phone IDs and template aliases.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="whatsapp_phone_number_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number ID</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 123456789" /></FormControl>
                    <FormDescription>Overrides WHATSAPP_PHONE_NUMBER_ID from ENV if set.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <FormField control={form.control} name="wa_template_host_notified" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Host Notified Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_phone_verify" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Verify (OTP) Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_payout_approved" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout Approved Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_payout_rejected" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payout Rejected Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_kyc_verified" render={({ field }) => (
                    <FormItem>
                      <FormLabel>KYC Verified Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_tokens_converted" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tokens Converted Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_referral_commission" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Commission Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_threshold_reached" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Threshold Reached Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wa_template_agent_assigned" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Assigned Template</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Payment Section */}
            <Card className="glass-card border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CreditCard className="h-5 w-5" />
                  Razorpay Integration
                </CardTitle>
                <CardDescription>Manage public payment gateway keys.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="razorpay_key_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razorpay Key ID (Public)</FormLabel>
                    <FormControl><Input {...field} placeholder="rzp_live_..." /></FormControl>
                    <FormDescription>The public key used for the Razorpay checkout modal.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply Service Configurations'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
