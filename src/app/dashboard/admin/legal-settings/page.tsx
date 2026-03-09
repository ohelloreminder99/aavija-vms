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
import { ArrowLeft, Loader2, Scale, Mail, MapPin, Briefcase } from 'lucide-react';
import { useSettings, clearSettingsCache } from '@/services/settings-service';
import { updateLegalSettingsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const legalSettingsSchema = z.object({
    legal_grievance_officer: z.string().min(1, 'Required'),
    legal_entity_name: z.string().min(1, 'Required'),
    legal_support_email: z.string().email('Invalid email address'),
    legal_address: z.string().min(1, 'Required'),
    legal_jurisdiction_city: z.string().min(1, 'Required'),
    legal_email: z.string().email('Invalid email address'),
});

type LegalSettingsFormValues = z.infer<typeof legalSettingsSchema>;

export default function LegalSettingsPage() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();
    const { data: settings, isLoading: settingsLoading } = useSettings();

    const form = useForm<LegalSettingsFormValues>({
        resolver: zodResolver(legalSettingsSchema),
        defaultValues: {
            legal_grievance_officer: '[Name/Legal Dept]',
            legal_entity_name: '99 Interactive Services',
            legal_support_email: 'support@99interactive.com',
            legal_address: '[Your Registered Address, Surat, Gujarat, India]',
            legal_jurisdiction_city: 'Surat, Gujarat, India',
            legal_email: 'legal@99interactive.com',
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                legal_grievance_officer: settings.legal_grievance_officer || '[Name/Legal Dept]',
                legal_entity_name: settings.legal_entity_name || '99 Interactive Services',
                legal_support_email: settings.legal_support_email || 'support@99interactive.com',
                legal_address: settings.legal_address || '[Your Registered Address, Surat, Gujarat, India]',
                legal_jurisdiction_city: settings.legal_jurisdiction_city || 'Surat, Gujarat, India',
                legal_email: settings.legal_email || 'legal@99interactive.com',
            });
        }
    }, [settings, form]);

    async function onSubmit(data: LegalSettingsFormValues) {
        setIsSubmitting(true);
        try {
            const result = await updateLegalSettingsAction(data);
            if (!result.success) {
                throw new Error(result.error);
            }
            clearSettingsCache();
            toast({ title: 'Legal Settings Updated', description: 'The privacy policy and terms variables have been updated dynamically.' });
        } catch (error: any) {
            console.error('Failed to update legal settings:', error);
            toast({ title: 'Update Failed', description: error.message || 'An error occurred.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (settingsLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container max-w-5xl py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/admin">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Scale className="h-7 w-7 text-primary" /> Legal & Compliance Settings
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Configure dynamic footprint variables shown on the Privacy Policy and Terms of Services pages.
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-primary" /> Entity Information
                            </CardTitle>
                            <CardDescription>
                                Core registered business information presented to the public.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="legal_entity_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Legal Entity Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="99 Interactive Services" {...field} />
                                            </FormControl>
                                            <FormDescription>The registered name of the business operating the app.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="legal_grievance_officer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Grievance Officer Name / Dept</FormLabel>
                                            <FormControl>
                                                <Input placeholder="[Name/Legal Dept]" {...field} />
                                            </FormControl>
                                            <FormDescription>Name or title of the Data Protecton Officer.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="legal_address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Registered Address</FormLabel>
                                        <FormControl>
                                            <Input placeholder="[Your Registered Address, Surat, Gujarat, India]" {...field} />
                                        </FormControl>
                                        <FormDescription>Physical address shown on the privacy policy grievance redressal block.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="legal_jurisdiction_city"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Governing Law Jurisdiction</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Surat, Gujarat, India" {...field} />
                                        </FormControl>
                                        <FormDescription>The court locus mapped to the Dispute Resolution clause in the Terms of Service.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" /> Contact Details
                            </CardTitle>
                            <CardDescription>
                                Email points of contact mapped to the legal pages.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="legal_support_email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Support Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="support@99interactive.com" type="email" {...field} />
                                            </FormControl>
                                            <FormDescription>General support email shown on Privacy Policy.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="legal_email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Legal / Law Enforcement Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="legal@99interactive.com" type="email" {...field} />
                                            </FormControl>
                                            <FormDescription>Direct line for legal inquiries shown on Terms of Service.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>


                    <div className="flex justify-end gap-4 pb-20">
                        <Button type="button" variant="outline" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Legal Settings
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
