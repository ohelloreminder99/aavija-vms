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
import { Loader2, Palette, Globe, Mail, Phone, ArrowLeft } from 'lucide-react';
import { useSettings, clearSettingsCache } from '@/services/settings-service';
import { updateSettingsAction } from '../token-settings/actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const brandingSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required.'),
  brand_tagline: z.string().min(1, 'Tagline is required.'),
  support_email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  support_phone: z.string().optional().or(z.literal('')),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

export default function BrandingSettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();

  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      brand_name: 'Aavija',
      brand_tagline: 'Visitor Management Ecosystem',
      support_email: '',
      support_phone: '',
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        brand_name: settings.brand_name || 'Aavija',
        brand_tagline: settings.brand_tagline || 'Visitor Management Ecosystem',
        support_email: settings.support_email || '',
        support_phone: settings.support_phone || '',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: BrandingFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction(data);
      if (!result.success) throw new Error(result.error);
      
      clearSettingsCache();
      toast({ title: 'Success', description: 'Branding settings updated successfully.' });
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
          <h1 className="text-3xl font-headline mb-2">Brand Identity</h1>
          <p className="text-zinc-500">Customize how your application appears to users and on official documents.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="glass-card border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Palette className="h-5 w-5" />
                  Visual Identity
                </CardTitle>
                <CardDescription>Configure public-facing names and slogans.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="brand_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Public Brand Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Aavija" /></FormControl>
                    <FormDescription>Used in headers, login screens, and mobile app title.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="brand_tagline" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slogan / Tagline</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Safe • Seamless • Secure" /></FormControl>
                    <FormDescription>Displayed in headers and on generated invoices.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Globe className="h-5 w-5" />
                  Support & Contact
                </CardTitle>
                <CardDescription>Public contact information for user queries.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="support_email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Support Email
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="support@aavija.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="support_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Support Phone
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="+91 12345 67890" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Branding Changes'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
