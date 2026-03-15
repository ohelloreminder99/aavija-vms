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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, ShieldAlert, Zap, Globe, MessageSquare, CreditCard, Clock } from 'lucide-react';
import { useSettings, clearSettingsCache } from '@/services/settings-service';
import { updateSettingsAction } from '../token-settings/actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const productionSettingsSchema = z.object({
  auth_rate_limit: z.coerce.number().min(1, 'Must be at least 1 attempt.'),
  checkin_rate_limit: z.coerce.number().min(1, 'Must be at least 1 check-in.'),
  whatsapp_rate_limit: z.coerce.number().min(1, 'Must be at least 1 notification.'),
  max_daily_token_purchase: z.coerce.number().min(1, 'Must be at least 1 token.'),
  emergency_access_timeout_mins: z.coerce.number().min(1, 'Must be at least 1 minute.'),
  is_maintenance_mode: z.boolean().default(false),
  maintenance_message: z.string().min(1, 'Maintenance message is required.'),
});

type ProductionSettingsFormValues = z.infer<typeof productionSettingsSchema>;

export default function ProductionSettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();

  const form = useForm<ProductionSettingsFormValues>({
    resolver: zodResolver(productionSettingsSchema),
    defaultValues: {
      auth_rate_limit: 10,
      checkin_rate_limit: 100,
      whatsapp_rate_limit: 500,
      max_daily_token_purchase: 1000,
      emergency_access_timeout_mins: 30,
      is_maintenance_mode: false,
      maintenance_message: 'System is undergoing maintenance. Please try again later.',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        auth_rate_limit: settings.auth_rate_limit ?? 10,
        checkin_rate_limit: settings.checkin_rate_limit ?? 100,
        whatsapp_rate_limit: settings.whatsapp_rate_limit ?? 500,
        max_daily_token_purchase: settings.max_daily_token_purchase ?? 1000,
        emergency_access_timeout_mins: settings.emergency_access_timeout_mins ?? 30,
        is_maintenance_mode: settings.is_maintenance_mode || false,
        maintenance_message: settings.maintenance_message || 'System is undergoing maintenance. Please try again later.',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: ProductionSettingsFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction(data);
      if (!result.success) throw new Error(result.error);
      
      clearSettingsCache();
      toast({ title: 'Success', description: 'Production & Security settings updated successfully.' });
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
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="h-3.5 w-3.5" />
          Production Control
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline mb-2">Production &amp; Security</h1>
          <p className="text-zinc-500">Configure real-time rate limits, emergency switches, and global security thresholds.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Maintenance Mode Section */}
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Danger Zone: Maintenance Mode
                </CardTitle>
                <CardDescription>
                  Enable this to prevent all database writes across the platform. Use only for critical emergency or scheduled upgrades.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="is_maintenance_mode" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-red-500/10 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Activate Maintenance Mode</FormLabel>
                      <FormDescription>Disconnects all user write operations immediately.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="maintenance_message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Maintenance Message</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="We'll be back soon..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rate Limits Section */}
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Zap className="h-5 w-5" />
                    Global Rate Limits
                  </CardTitle>
                  <CardDescription>Manage traffic thresholds per minute/hour.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="auth_rate_limit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> Auth Attempts / Min
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Login/Signup attempts per IP per minute.</FormDescription>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="checkin_rate_limit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" /> Check-ins / Hour
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Max check-ins allowed per premise gate per hour.</FormDescription>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="whatsapp_rate_limit" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" /> Notifications / Hour
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Global budget for WhatsApp notifications per hour.</FormDescription>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Security thresholds Section */}
              <Card className="glass-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <ShieldAlert className="h-5 w-5" />
                    Security Thresholds
                  </CardTitle>
                  <CardDescription>Configure fraud prevention and safety limits.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="max_daily_token_purchase" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Max Daily Purchase
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Maximum token amount a user can buy in 24h.</FormDescription>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="emergency_access_timeout_mins" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Emergency Access (Mins)
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormDescription>Duration emergency contact is visible to staff.</FormDescription>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply Configuration Updates'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
