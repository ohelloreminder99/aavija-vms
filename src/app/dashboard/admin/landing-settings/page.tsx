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
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save, Globe } from 'lucide-react';
import { useSettings, updateSettings } from '@/services/settings-service';
import { useFirestore } from '@/supabase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const landingSettingsSchema = z.object({
    landing_hero_title: z.string().min(1, 'Hero title is required.'),
    landing_hero_subtitle: z.string().min(1, 'Hero subtitle is required.'),
    landing_cta_primary: z.string().min(1, 'Primary CTA text is required.'),
    landing_cta_secondary: z.string().min(1, 'Secondary CTA text is required.'),
});

type LandingSettingsFormValues = z.infer<typeof landingSettingsSchema>;

export default function LandingSettingsPage() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const { data: settings, isLoading } = useSettings();

    const form = useForm<LandingSettingsFormValues>({
        resolver: zodResolver(landingSettingsSchema),
        defaultValues: {
            landing_hero_title: '',
            landing_hero_subtitle: '',
            landing_cta_primary: '',
            landing_cta_secondary: '',
        },
    });

    React.useEffect(() => {
        if (settings) {
            form.reset({
                landing_hero_title: settings.landing_hero_title || '',
                landing_hero_subtitle: settings.landing_hero_subtitle || '',
                landing_cta_primary: settings.landing_cta_primary || '',
                landing_cta_secondary: settings.landing_cta_secondary || '',
            });
        }
    }, [settings, form]);

    const onSubmit = async (data: LandingSettingsFormValues) => {
        setIsSubmitting(true);
        try {
            await updateSettings(firestore, data);
            toast({ title: 'Settings Updated', description: 'Landing page content has been saved successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed', description: 'An error occurred while saving settings.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container py-10 flex justify-center">
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
                <div className="flex items-center gap-2 text-muted-foreground italic text-sm">
                    <Globe className="w-4 h-4" />
                    <span>Regional Subdomain Control (India)</span>
                </div>
            </div>

            <Card className="border-blue-500/20">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        Landing Page Content
                        <span className="text-xs font-normal text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">Premium v2</span>
                    </CardTitle>
                    <CardDescription>
                        Customize the "WOW" experience for your regional audience. Changes reflect immediately on india.aavija.com.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <div className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="landing_hero_title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hero Headline</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Simple, Safe & Secure." {...field} />
                                            </FormControl>
                                            <FormDescription>The main bold title on the homepage.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="landing_hero_subtitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hero Sub-headline</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Describe your value proposition..."
                                                    className="min-h-[100px] resize-none"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>Provide more context about Aavija to prospective users.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="landing_cta_primary"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Primary Button Text</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Get Started Free" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="landing_cta_secondary"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Secondary Button Text</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Watch Product Tour" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                <h4 className="text-sm font-semibold mb-2">Pro Tip</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Use impactful words like "Instant", "Secure", and "Sovereign" to establish trust. The last word of the Headline will automatically receive an Electric Blue gradient for maximum visual punch.
                                </p>
                            </div>

                            <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg">
                                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                Save Landing Page Settings
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
