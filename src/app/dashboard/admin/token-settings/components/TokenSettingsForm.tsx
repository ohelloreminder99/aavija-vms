'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Building2, Smartphone, Coins, FileText, UserCog, ShieldCheck } from 'lucide-react';
import { useSettings, clearSettingsCache } from '@/services/settings-service';
import { updateSettingsAction } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { useStates } from '@/services/state-service';

export const tokenSettingsSchema = z.object({
  starting_token_visitor: z.coerce.number().min(0, 'Tokens must be a non-negative number.'),
  starting_token_owner: z.coerce.number().min(0, 'Tokens must be a non-negative number.'),
  low_token_threshold: z.coerce.number().min(0, 'Threshold must be a non-negative number.'),
  star_rating_cost: z.coerce.number().min(0, 'Cost must be a non-negative number.'),
  block_visitor_cost: z.coerce.number().min(0, 'Cost must be a non-negative number.'),
  unblock_visitor_cost: z.coerce.number().min(0, 'Cost must be a non-negative number.'),
  block_visitor_cost_host: z.coerce.number().min(0, "Cost must be non-negative."),
  unblock_visitor_cost_host: z.coerce.number().min(0, "Cost must be non-negative."),
  pdf_export_cost_host: z.coerce.number().min(0, 'Cost must be non-negative.'),
  csv_export_cost_host: z.coerce.number().min(0, 'Cost must be non-negative.'),
  pdf_export_cost_visitor: z.coerce.number().min(0, 'Cost must be non-negative.'),
  csv_export_cost_visitor: z.coerce.number().min(0, 'Cost must be non-negative.'),
  default_country_code: z.string().startsWith('+', { message: "Country code must start with a '+'." }),
  phone_number_length: z.coerce.number().min(1, 'Length must be a positive number.'),
  mobile_verification_cost: z.coerce.number().min(0, 'Cost must be a non-negative number.'),
  otp_request_limit_hourly: z.coerce.number().min(1, 'Limit must be at least 1.').optional(),
  otp_validity_duration_seconds: z.coerce.number().min(30, 'Must be at least 30 seconds.').default(300),
  otp_spam_cooldown_minutes: z.coerce.number().min(1, 'Must be at least 1 minute.').default(60),
  allow_unverified_checkin: z.boolean().default(false),
  qr_code_expiry_seconds: z.coerce.number().min(10, 'Must be at least 10 seconds.').default(60),
  rate_limit_max_requests: z.coerce.number().min(1, 'Must be at least 1.').default(5),
  rate_limit_window_ms: z.coerce.number().min(1000, 'Must be at least 1000ms.').default(60000),
  allow_concurrent_checkins: z.boolean().default(false),
  company_name_billing: z.string().optional(),
  company_gstin: z.string().optional(),
  company_address_billing: z.string().optional(),
  company_state_billing: z.string().optional(),
  hsn_sac_code: z.string().optional(),
  cgst_rate_default: z.coerce.number().min(0).max(100).optional(),
  sgst_rate_default: z.coerce.number().min(0).max(100).optional(),
  igst_rate_default: z.coerce.number().min(0).max(100).optional(),
  currency: z.string().min(1, 'Please select a currency.'),
  token_exchange_rate: z.coerce.number().min(0, 'Exchange rate must be a non-negative number.'),
  gst_rate: z.coerce.number().min(0).max(100, 'GST rate cannot exceed 100.'),
  agent_commission_rate: z.coerce.number().min(0).max(100, 'Commission rate cannot exceed 100.'),
  show_token_card_visitor: z.boolean().default(false),
  hide_token_economy: z.boolean().default(false),
  enable_multilingual: z.boolean().default(true),
  payout_threshold_agent: z.coerce.number().min(0, 'Must be non-negative.'),
  token_conversion_rate: z.coerce.number().min(0, 'Must be non-negative.'),
  payout_method_note: z.string().optional(),
  tds_enabled: z.boolean().default(false),
  tds_rate: z.coerce.number().min(0).max(100).optional(),
  tds_annual_exemption: z.coerce.number().min(0).optional(),
  referral_enabled: z.boolean().default(false),
  referral_commission_rate: z.coerce.number().min(0).max(1, 'Enter as decimal e.g. 0.05 for 5%.').optional(),
  referral_min_purchase_tokens: z.coerce.number().min(0).optional(),
  referral_reward_tokens: z.coerce.number().min(0).optional(),
});

export type TokenSettingsFormValues = z.infer<typeof tokenSettingsSchema>;

export function TokenSettingsForm({ userProfile }: { userProfile: any }) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const { data: states } = useStates();

  const currencies = [
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
  ];

  const currencySymbols: { [key: string]: string } = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$',
  };

  const form = useForm<TokenSettingsFormValues>({
    resolver: zodResolver(tokenSettingsSchema),
    defaultValues: {
      starting_token_visitor: 0,
      starting_token_owner: 0,
      low_token_threshold: 0,
      star_rating_cost: 0,
      block_visitor_cost: 0,
      unblock_visitor_cost: 0,
      block_visitor_cost_host: 0,
      unblock_visitor_cost_host: 0,
      pdf_export_cost_host: 0,
      csv_export_cost_host: 0,
      pdf_export_cost_visitor: 0,
      csv_export_cost_visitor: 0,
      default_country_code: '+91',
      phone_number_length: 10,
      mobile_verification_cost: 0,
      otp_request_limit_hourly: 3,
      otp_validity_duration_seconds: 300,
      otp_spam_cooldown_minutes: 60,
      allow_unverified_checkin: false,
      qr_code_expiry_seconds: 60,
      rate_limit_max_requests: 5,
      rate_limit_window_ms: 60000,
      allow_concurrent_checkins: false,
      company_name_billing: '',
      company_gstin: '',
      company_address_billing: '',
      company_state_billing: '',
      hsn_sac_code: '997331',
      cgst_rate_default: 9,
      sgst_rate_default: 9,
      igst_rate_default: 18,
      currency: 'INR',
      token_exchange_rate: 1,
      gst_rate: 18,
      agent_commission_rate: 0,
      show_token_card_visitor: false,
      hide_token_economy: false,
      enable_multilingual: true,
      payout_threshold_agent: 500,
      token_conversion_rate: 1,
      payout_method_note: '',
      tds_enabled: false,
      tds_rate: 10,
      tds_annual_exemption: 30000,
      referral_enabled: false,
      referral_commission_rate: 0.05,
      referral_min_purchase_tokens: 50,
      referral_reward_tokens: 10,
    },
  });

  const watchedCurrency = form.watch('currency');

  React.useEffect(() => {
    if (settings) {
      form.reset({
        starting_token_visitor: settings.starting_token_visitor ?? 0,
        starting_token_owner: settings.starting_token_owner ?? 0,
        low_token_threshold: settings.low_token_threshold ?? 0,
        star_rating_cost: settings.star_rating_cost ?? 0,
        block_visitor_cost: settings.block_visitor_cost ?? 0,
        unblock_visitor_cost: settings.unblock_visitor_cost ?? 0,
        block_visitor_cost_host: settings.block_visitor_cost_host ?? 0,
        unblock_visitor_cost_host: settings.unblock_visitor_cost_host ?? 0,
        pdf_export_cost_host: settings.pdf_export_cost_host ?? 0,
        csv_export_cost_host: settings.csv_export_cost_host ?? 0,
        pdf_export_cost_visitor: settings.pdf_export_cost_visitor ?? 0,
        csv_export_cost_visitor: settings.csv_export_cost_visitor ?? 0,
        default_country_code: settings.default_country_code || '+91',
        phone_number_length: settings.phone_number_length || 10,
        mobile_verification_cost: settings.mobile_verification_cost ?? 0,
        otp_request_limit_hourly: settings.otp_request_limit_hourly ?? 3,
        otp_validity_duration_seconds: settings.otp_validity_duration_seconds ?? 300,
        otp_spam_cooldown_minutes: settings.otp_spam_cooldown_minutes ?? 60,
        allow_unverified_checkin: settings.allow_unverified_checkin || false,
        qr_code_expiry_seconds: settings.qr_code_expiry_seconds ?? 60,
        rate_limit_max_requests: settings.rate_limit_max_requests ?? 5,
        rate_limit_window_ms: settings.rate_limit_window_ms ?? 60000,
        allow_concurrent_checkins: settings.allow_concurrent_checkins || false,
        company_name_billing: settings.company_name_billing || '',
        company_gstin: settings.company_gstin || '',
        company_address_billing: settings.company_address_billing || '',
        company_state_billing: settings.company_state_billing || '',
        hsn_sac_code: settings.hsn_sac_code || '997331',
        cgst_rate_default: settings.cgst_rate_default ?? 9,
        sgst_rate_default: settings.sgst_rate_default ?? 9,
        igst_rate_default: settings.igst_rate_default ?? 18,
        currency: settings.currency || 'INR',
        token_exchange_rate: settings.token_exchange_rate ?? 1,
        gst_rate: settings.gst_rate ?? 18,
        agent_commission_rate: settings.agent_commission_rate ?? 0,
        show_token_card_visitor: settings.show_token_card_visitor || false,
        hide_token_economy: settings.hide_token_economy || false,
        enable_multilingual: settings.enable_multilingual ?? true,
        payout_threshold_agent: settings.payout_threshold_agent ?? 500,
        token_conversion_rate: settings.token_conversion_rate ?? 1,
        payout_method_note: settings.payout_method_note || '',
        tds_enabled: settings.tds_enabled || false,
        tds_rate: settings.tds_rate ?? 10,
        tds_annual_exemption: settings.tds_annual_exemption ?? 30000,
        referral_enabled: settings.referral_enabled || false,
        referral_commission_rate: settings.referral_commission_rate ?? 0.05,
        referral_min_purchase_tokens: settings.referral_min_purchase_tokens ?? 50,
        referral_reward_tokens: settings.referral_reward_tokens ?? 10,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: TokenSettingsFormValues) => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction(data);
      if (!result.success) {
        throw new Error(result.error);
      }
      clearSettingsCache();
      toast({ title: 'Settings Updated', description: 'All token and economy settings have been saved.' });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'An error occurred while saving.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

        {/* Section 1: General Costs & Allocations */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Coins className="h-5 w-5" /> General Costs &amp; Allocations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="starting_token_visitor" render={({ field }) => (
              <FormItem><FormLabel>Visitor: Initial Tokens</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens a new visitor receives on sign-up.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="starting_token_owner" render={({ field }) => (
              <FormItem><FormLabel>Premise: Initial Tokens</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens a new premise receives upon creation.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="low_token_threshold" render={({ field }) => (
              <FormItem><FormLabel>Low Token Warning Threshold</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Threshold to trigger a low token balance warning.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="star_rating_cost" render={({ field }) => (
              <FormItem><FormLabel>Star Rating Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens deducted from a host when they submit a star rating.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="block_visitor_cost" render={({ field }) => (
              <FormItem><FormLabel>Premise: Block Visitor Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens deducted from a premise's balance when an owner blocks a visitor.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="unblock_visitor_cost" render={({ field }) => (
              <FormItem><FormLabel>Premise: Unblock Visitor Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens deducted from a premise's balance when an owner unblocks a visitor.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        {/* Section 2: Host Action Costs */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <UserCog className="h-5 w-5" /> Host Action Costs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="block_visitor_cost_host" render={({ field }) => (
              <FormItem><FormLabel>Host: Block Visitor Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens deducted from a host's personal balance when they block a visitor.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="unblock_visitor_cost_host" render={({ field }) => (
              <FormItem><FormLabel>Host: Unblock Visitor Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Tokens deducted from a host's personal balance when they unblock a visitor.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        {/* Section 3: Export Costs */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <FileText className="h-5 w-5" /> Export Costs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="csv_export_cost_host" render={({ field }) => (
              <FormItem><FormLabel>Host: CSV Export Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Token cost for a Host to export history as a CSV file.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="pdf_export_cost_host" render={({ field }) => (
              <FormItem><FormLabel>Host: PDF Export Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Token cost for a Host to export history as a PDF file.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="csv_export_cost_visitor" render={({ field }) => (
              <FormItem><FormLabel>Visitor: CSV Export Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Token cost for a Visitor to export their history as a CSV file.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="pdf_export_cost_visitor" render={({ field }) => (
              <FormItem><FormLabel>Visitor: PDF Export Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Token cost for a Visitor to export their history as a PDF file.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        {/* Section 4: Phone & Verification */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Phone &amp; Verification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="default_country_code" render={({ field }) => (
              <FormItem><FormLabel>Default Country Code</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>The default country code for phone number verification.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="phone_number_length" render={({ field }) => (
              <FormItem><FormLabel>Phone Number Length</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>The exact number of digits required for phone numbers (e.g., 10 for India).</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="mobile_verification_cost" render={({ field }) => (
              <FormItem><FormLabel>Mobile Verification Cost</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Cost in tokens for a user to verify their phone number.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="otp_request_limit_hourly" render={({ field }) => (
              <FormItem><FormLabel>OTP Request Limit (per hour)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Max number of OTPs a user can request in one hour before trigging a cooldown.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="otp_spam_cooldown_minutes" render={({ field }) => (
              <FormItem><FormLabel>OTP Spam Cooldown (Minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>How long a user is blocked from requesting an OTP if they exceed the hourly limit.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="otp_validity_duration_seconds" render={({ field }) => (
              <FormItem><FormLabel>OTP Code Validity (Seconds)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>How long an OTP code remains valid after being sent.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="allow_unverified_checkin" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Allow Unverified Check-in</FormLabel>
                  <FormDescription>If enabled, visitors can generate a QR code even without a verified phone number.</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        {/* Section 5: Billing & GST */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Building2 className="h-5 w-5" /> GST &amp; Billing Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="company_name_billing" render={({ field }) => (
              <FormItem><FormLabel>Company Name (for Invoices)</FormLabel><FormControl><Input placeholder="e.g., 99 Interactive Services" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="company_gstin" render={({ field }) => (
              <FormItem><FormLabel>Your GSTIN</FormLabel><FormControl><Input placeholder="27XXXXX0000X1Z5" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="company_address_billing" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Registered Office Address</FormLabel><FormControl><Textarea placeholder="Full address for billing" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="company_state_billing" render={({ field }) => (
              <FormItem>
                <FormLabel>Home State (for GST Logic)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                  <SelectContent>{states?.map((s: any) => (<SelectItem key={s.id} value={s.name} className="capitalize">{s.name}</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>Determines if CGST/SGST or IGST applies.</FormDescription>
              </FormItem>
            )} />
            <FormField control={form.control} name="hsn_sac_code" render={({ field }) => (
              <FormItem><FormLabel>HSN/SAC Code</FormLabel><FormControl><Input placeholder="e.g., 997331" {...field} /></FormControl></FormItem>
            )} />
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
              <FormField control={form.control} name="cgst_rate_default" render={({ field }) => (<FormItem><FormLabel>CGST %</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="sgst_rate_default" render={({ field }) => (<FormItem><FormLabel>SGST %</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="igst_rate_default" render={({ field }) => (<FormItem><FormLabel>IGST %</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>)} />
            </div>
          </div>
        </div>

        {/* Section 5.5: Security & Limits */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Security &amp; Rate Limits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="qr_code_expiry_seconds" render={({ field }) => (
              <FormItem><FormLabel>QR Code Expiry (Seconds)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>How long a check-in code remains valid before dying.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="rate_limit_max_requests" render={({ field }) => (
              <FormItem><FormLabel>DDoS: Max Code Generation</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Maximum check-in codes generated per window.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="rate_limit_window_ms" render={({ field }) => (
              <FormItem><FormLabel>DDoS: Time Window (ms)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>The sliding timeframe for rate-limiting calculations (e.g. 60000 for 1 minute).</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="allow_concurrent_checkins" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-accent/5">
                <div className="space-y-0.5">
                  <FormLabel className="text-base text-amber-500">Allow Concurrent Check-ins</FormLabel>
                  <FormDescription>If enabled, visitors can physically check into a second premise while actively inside another premise without checking out first.</FormDescription>
                </div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        {/* Section 6: Payment & Currency */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <Coins className="h-5 w-5" /> Payment &amp; Currency
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="currency" render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                  <SelectContent>{currencies.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>))}</SelectContent>
                </Select>
                <FormDescription>The currency used for token transactions.</FormDescription>
              </FormItem>
            )} />
            <FormField control={form.control} name="token_exchange_rate" render={({ field }) => (
              <FormItem>
                <FormLabel>Exchange Rate</FormLabel>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">1 Token =</span>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <span className="text-sm font-medium text-muted-foreground">{currencySymbols[watchedCurrency] || watchedCurrency}</span>
                </div>
                <FormDescription>The value of one token in the selected currency.</FormDescription>
              </FormItem>
            )} />
            <FormField control={form.control} name="gst_rate" render={({ field }) => (
              <FormItem><FormLabel>GST Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>The overall tax rate applied to token purchases.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="agent_commission_rate" render={({ field }) => (
              <FormItem><FormLabel>Agent Commission Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Commission agents receive on premise token purchases.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        {/* Section 7: Agent Payouts (Phase 2B) */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Agent Payout Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="payout_threshold_agent" render={({ field }) => (
              <FormItem><FormLabel>Agent Payout Threshold (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Minimum balance required before agent can request a payout.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="token_conversion_rate" render={({ field }) => (
              <FormItem><FormLabel>Token Conversion Rate</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormDescription>How many tokens per ₹1 of commission when converting to tokens.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="payout_method_note" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Payout Method Note (shown to user)</FormLabel><FormControl><Textarea placeholder="e.g. Payouts processed every Monday" {...field} /></FormControl></FormItem>
            )} />
          </div>
        </div>

        {/* Section 8: TDS Compliance (Phase 2B) */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" /> TDS Compliance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="tds_enabled" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2">
                <div className="space-y-0.5"><FormLabel className="text-base">Enable TDS Deduction</FormLabel><FormDescription>Deduct TDS from agent/referrer payouts as per Income Tax rules.</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="tds_rate" render={({ field }) => (
              <FormItem><FormLabel>TDS Rate (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormDescription>Standard rate: 10% for commissions above exemption (Section 194H).</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="tds_annual_exemption" render={({ field }) => (
              <FormItem><FormLabel>Annual TDS Exemption (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>TDS only applies to annual payout amounts above this limit.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        {/* Section 9: Referral Program (Phase 2C) */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
            <UserCog className="h-5 w-5 text-green-600" /> Referral Program
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="referral_enabled" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2 bg-green-50">
                <div className="space-y-0.5"><FormLabel className="text-base text-green-700">Enable Referral Program</FormLabel><FormDescription>Allow users to share referral codes and earn real-money commission.</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="referral_commission_rate" render={({ field }) => (
              <FormItem><FormLabel>Referral Commission Rate</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.05" {...field} /></FormControl><FormDescription>Decimal format: 0.05 = 5% of each purchase value.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="referral_min_purchase_tokens" render={({ field }) => (
              <FormItem><FormLabel>Min. Purchase to Qualify (tokens)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Referee must buy at least this many tokens to trigger commission. Set 0 to disable.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="referral_reward_tokens" render={({ field }) => (
              <FormItem><FormLabel>Welcome Gift Tokens (for referee)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Bonus tokens credited to new user who signs up via referral link. Set 0 to disable.</FormDescription></FormItem>
            )} />
          </div>
        </div>

        <div className="border-t pt-6">
          <FormField control={form.control} name="show_token_card_visitor" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-accent/5">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Show Personal Token Balance Card</FormLabel>
                <FormDescription>Control visibility of the personal token balance card in the Visitor and Host dashboards.</FormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="hide_token_economy" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-destructive/5 mt-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base text-destructive">Global: Hide Token Economy</FormLabel>
                <FormDescription>If enabled, this completely hides the token economy across all dashboards (balances, ledgers, pricing) and bypasses restrictive check-in token checks.</FormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="enable_multilingual" render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5 mt-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base text-primary">Global: Enable Multi-lingual Dropdowns</FormLabel>
                <FormDescription>If enabled, a beautiful regional language drop-down will appear across the platform allowing users to dynamically switch the entire app's vocabulary on the fly.</FormDescription>
              </div>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
