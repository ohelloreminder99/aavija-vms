'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Loader2, Info, ExternalLink } from 'lucide-react';
import { useSettings, updateSettings } from '@/services/settings-service';
import { useFirestore, useUser } from '@/supabase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useUserProfile } from '@/services/user-service';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const historySettingsSchema = z.object({
  history_days_owner: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  history_days_gatekeeper: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  history_days_host: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  history_days_staff: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  history_days_visitor: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  export_history_days_owner: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  export_history_days_host: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  export_history_days_visitor: z.coerce.number().min(0, 'Days must be a non-negative number.'),
  log_ttl_days: z.coerce.number().min(0, 'TTL must be a non-negative number.'),
  visit_ttl_days: z.coerce.number().min(0, 'TTL must be a non-negative number.'),
});

type HistorySettingsFormValues = z.infer<typeof historySettingsSchema>;

const roleFields: { name: keyof HistorySettingsFormValues, label: string, description: string }[] = [
  { name: 'history_days_owner', label: 'Owner History (days)', description: 'How many days of visit history an Owner can see on their dashboard.' },
  { name: 'history_days_gatekeeper', label: 'Gatekeeper History (days)', description: 'How many days of visit history a Gatekeeper can see.' },
  { name: 'history_days_host', label: 'Host History (days)', description: 'How many days of visit history a Host can see.' },
  { name: 'history_days_visitor', label: 'Visitor History (days)', description: 'How many days of their own visit history a Visitor can see.' },
  { name: 'history_days_staff', label: 'Staff History (days)', description: 'How many days of history a Staff member can see.' },
];

const exportRoleFields: { name: keyof HistorySettingsFormValues, label: string, description: string }[] = [
  { name: 'export_history_days_owner', label: 'Owner Export History (days)', description: 'Max days an Owner can include in a paid export.' },
  { name: 'export_history_days_host', label: 'Host Export History (days)', description: 'Max days a Host can include in a paid export.' },
  { name: 'export_history_days_visitor', label: 'Visitor Export History (days)', description: 'Max days a Visitor can include in a paid export.' },
];


export default function HistorySettingsPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);

  const form = useForm<HistorySettingsFormValues>({
    resolver: zodResolver(historySettingsSchema),
    defaultValues: {
      history_days_owner: 0,
      history_days_gatekeeper: 0,
      history_days_host: 0,
      history_days_staff: 0,
      history_days_visitor: 0,
      export_history_days_owner: 0,
      export_history_days_host: 0,
      export_history_days_visitor: 0,
      log_ttl_days: 0,
      visit_ttl_days: 0,
    },
  });

  React.useEffect(() => {
    if (settings) {
      const defaultValues: Partial<HistorySettingsFormValues> = {
        history_days_owner: settings.history_days_owner || 0,
        history_days_gatekeeper: settings.history_days_gatekeeper || 0,
        history_days_host: settings.history_days_host || 0,
        history_days_staff: settings.history_days_staff || 0,
        history_days_visitor: settings.history_days_visitor || 0,
        export_history_days_owner: settings.export_history_days_owner || 0,
        export_history_days_host: settings.export_history_days_host || 0,
        export_history_days_visitor: settings.export_history_days_visitor || 0,
        log_ttl_days: settings.log_ttl_days || 0,
        visit_ttl_days: settings.visit_ttl_days || 0,
      };
      form.reset(defaultValues as HistorySettingsFormValues);
    }
  }, [settings, form]);

  const onSubmit = async (data: HistorySettingsFormValues) => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user.' });
      return;
    }
    setIsSubmitting(true);
    updateSettings(firestore, data);
    toast({ title: 'Settings Updated', description: 'History and TTL settings have been saved.' });
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>History & Data Retention</CardTitle>
          <CardDescription>
            Configure how many days of history are visible and how long data is retained before deletion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              <div>
                <h3 className="text-lg font-medium">Visible History Limits</h3>
                <p className="text-sm text-muted-foreground">Free history window visible on dashboards.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {roleFields.map((fieldInfo) => (
                    <FormField
                      key={fieldInfo.name}
                      control={form.control}
                      name={fieldInfo.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fieldInfo.label}</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 30" {...field} />
                          </FormControl>
                          <FormDescription>
                            {fieldInfo.description}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium">Exportable History Limits</h3>
                <p className="text-sm text-muted-foreground">Maximum window for paid CSV/PDF exports.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {exportRoleFields.map((fieldInfo) => (
                    <FormField
                      key={fieldInfo.name}
                      control={form.control}
                      name={fieldInfo.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fieldInfo.label}</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 365" {...field} />
                          </FormControl>
                          <FormDescription>
                            {fieldInfo.description}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Data Retention (TTL)</h3>
                  <p className="text-sm text-muted-foreground">Automatic deletion of old records to manage database costs.</p>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Activation Required</AlertTitle>
                  <AlertDescription>
                    <div className="text-sm text-muted-foreground mt-4 pb-2 border-b">
                      <p>Changing these numbers only sets the "Expiration Date" on new records. To enable deletion, you must create <strong>Cron Jobs</strong> in the Supabase Dashboard:</p>
                      <ol className="list-decimal pl-5 mt-2 space-y-1">
                        <li>Go to <strong>Database</strong> &gt; <strong>Extensions</strong> and enable <code>pg_cron</code>.</li>
                        <li>Write a SQL script to automatically trigger <code>DELETE FROM public.* WHERE "expiresAt" &lt; NOW()</code> on a schedule.</li>
                      </ol>
                    </div>  <Button variant="link" className="p-0 h-auto text-xs" asChild>
                      <a href="https://supabase.com/dashboard" target="_blank">Open Console <ExternalLink className="ml-1 h-3 w-3" /></a>
                    </Button>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <FormField
                    control={form.control}
                    name="log_ttl_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audit Log Retention (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 90" {...field} />
                        </FormControl>
                        <FormDescription>
                          Days until audit logs are deleted.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visit_ttl_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit History Retention (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 365" {...field} />
                        </FormControl>
                        <FormDescription>
                          Days until visit records are deleted.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save History Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

