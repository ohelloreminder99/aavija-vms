import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Settings } from '@/services/settings-service';
import { useCities } from '@/services/city-service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/user-service';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { sendWhatsAppOtp, verifyWhatsAppOtp } from '@/app/dashboard/profile/actions';

export interface UserSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    settings?: Settings | null;
    onComplete: () => void;
}

export function UserSetupDialog({ open, onOpenChange, userId, settings, onComplete }: UserSetupDialogProps) {
    const [citySearch, setCitySearch] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [step, setStep] = React.useState<'details' | 'otp'>('details');
    const { data: cities } = useCities();
    const { toast } = useToast();
    const router = useRouter();

    const phoneLength = settings?.phone_number_length || 10;
    const defaultCountryCode = settings?.default_country_code || '+91';

    const formSchema = React.useMemo(() => {
        return z.object({
            phone: z.string()
                .length(phoneLength, { message: `Phone number must be exactly ${phoneLength} digits.` })
                .regex(/^[0-9]+$/, { message: 'Phone number must contain only digits.' }),
            cityId: z.string().min(1, 'Please select your city.'),
            otp: z.string().optional(),
        });
    }, [phoneLength]);

    type FormValues = z.infer<typeof formSchema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            phone: '',
            cityId: '',
            otp: '',
        },
    });

    const filteredCities = React.useMemo(() =>
        cities?.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase())) || [],
        [cities, citySearch]);

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true);
        try {
            if (step === 'details') {
                const selectedCityObj = cities?.find(c => c.id === data.cityId);

                // 1. Save initial profile data
                await updateUserProfile(userId, {
                    phone: data.phone,
                    cityId: data.cityId,
                    city: selectedCityObj?.name || 'Unknown',
                    city_state: selectedCityObj?.stateName || 'Unknown',
                    is_verified: false,
                } as any);

                // 2. Request OTP
                const res = await sendWhatsAppOtp({
                    userId,
                    phone: data.phone,
                    countryCode: defaultCountryCode,
                });

                if (!res.success) {
                    throw new Error(res.error || 'Failed to send OTP.');
                }

                toast({
                    title: 'OTP Sent',
                    description: `A verification code has been sent to ${defaultCountryCode} ${data.phone}.`,
                });
                setStep('otp');
            } else {
                // Step 2: Verify OTP
                if (!data.otp || data.otp.length < 6) {
                    throw new Error('Please enter a valid 6-digit OTP.');
                }
                const res = await verifyWhatsAppOtp({
                    userId,
                    otp: data.otp,
                    phone: data.phone,
                    countryCode: defaultCountryCode,
                });

                if (!res.success) {
                    throw new Error(res.error || 'Failed to verify OTP.');
                }

                toast({
                    title: 'Verification Complete',
                    description: res.message || 'Your phone number has been verified successfully.',
                });
                form.reset();
                onComplete();
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: step === 'details' ? 'Setup Failed' : 'Verification Failed',
                description: error.message || 'An error occurred.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Prevent closing the dialog by clicking outside or pressing Escape
    // The user MUST finish setting up their account to use the app.
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) return;
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{step === 'details' ? 'Complete Your Profile' : 'Verify Mobile Number'}</DialogTitle>
                    <DialogDescription>
                        {step === 'details'
                            ? 'Welcome! Before you can use the dashboard, we need a few details to finalize your account setup.'
                            : `Enter the 6-digit code sent to ${defaultCountryCode} ${form.getValues('phone')} via WhatsApp.`}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                        <div className={step === 'details' ? "space-y-6" : "hidden"}>
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile Number</FormLabel>
                                        <FormControl>
                                            <Input type="tel" placeholder={`Enter ${phoneLength} digits...`} {...field} disabled={isSubmitting} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="cityId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>City</FormLabel>
                                        <Input
                                            placeholder="Search your city..."
                                            value={citySearch}
                                            onChange={(e) => setCitySearch(e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                        <ScrollArea className="h-36 w-full rounded-md border mt-2 bg-muted/20">
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="p-4" disabled={isSubmitting}>
                                                    {filteredCities.map(c => (
                                                        <div key={c.id} className="flex items-center space-x-2 mb-2">
                                                            <RadioGroupItem value={c.id} id={`city-${c.id}`} />
                                                            <Label htmlFor={`city-${c.id}`} className="font-normal capitalize cursor-pointer">
                                                                {c.name}, {c.stateName}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                        </ScrollArea>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {step === 'otp' && (
                            <FormField
                                control={form.control}
                                name="otp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>6-Digit WhatsApp OTP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="123456" {...field} maxLength={6} disabled={isSubmitting} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {step === 'details' ? 'Sending OTP...' : 'Verifying...'}
                                </>
                            ) : (
                                step === 'details' ? 'Send OTP' : 'Verify & Continue'
                            )}
                        </Button>

                        {step === 'otp' && (
                            <Button type="button" variant="ghost" className="w-full mt-2" onClick={() => setStep('details')} disabled={isSubmitting}>
                                Back to Details
                            </Button>
                        )}
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
