'use client';

import * as React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UseFormReturn } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsAppOtp, verifyWhatsAppOtp } from './actions';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/services/user-service';
import { Settings } from '@/services/settings-service';

interface PhoneVerificationProps {
    form: UseFormReturn<any>;
    isPhoneLocked: boolean;
    setIsPhoneLocked: (locked: boolean) => void;
    userProfile: UserProfile | null | undefined;
    settings: Settings | null | undefined;
}

export function PhoneVerification({
    form,
    isPhoneLocked,
    setIsPhoneLocked,
    userProfile,
    settings,
}: PhoneVerificationProps) {
    const { toast } = useToast();
    const [isVerifying, setIsVerifying] = React.useState(false);
    const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = React.useState(false);
    const [otpSent, setOtpSent] = React.useState(false);
    const [otp, setOtp] = React.useState('');
    const [verificationError, setVerificationError] = React.useState<string | null>(null);

    const mobileVerificationCost = settings?.mobile_verification_cost ?? 0;
    const hasSufficientTokens = (userProfile?.token_balance_visitor ?? 0) >= mobileVerificationCost;

    const handleSendOtp = async () => {
        const phone = form.getValues('phone');
        const countryCode = form.getValues('countryCode');

        if (!phone) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a phone number.' });
            return;
        }

        if (!hasSufficientTokens) {
            toast({ variant: 'destructive', title: 'Insufficient Tokens', description: `You need ${mobileVerificationCost} tokens to verify your mobile number.` });
            return;
        }

        if (!userProfile) return;
        setIsVerifying(true);
        setVerificationError(null);
        try {
            const result = await sendWhatsAppOtp({ userId: userProfile.id, phone, countryCode });
            if (result.success) {
                setOtpSent(true);
                toast({ title: 'OTP Sent', description: 'Please check your WhatsApp for the verification code.' });
            } else {
                setVerificationError(result.error || 'Failed to send OTP.');
            }
        } catch (error) {
            setVerificationError('An unexpected error occurred.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleConfirmCode = async () => {
        if (otp.length !== 6) return;
        if (!userProfile) return;
        setIsVerifying(true);
        setVerificationError(null);
        try {
            const result = await verifyWhatsAppOtp({ userId: userProfile.id, otp, phone: form.getValues('phone'), countryCode: form.getValues('countryCode') });
            if (result.success) {
                setIsPhoneLocked(true);
                setOtpSent(false);
                setOtp('');
                toast({ title: 'Verified!', description: 'Your phone number has been successfully verified.' });
            } else {
                setVerificationError(result.error || 'Invalid verification code.');
            }
        } catch (error) {
            setVerificationError('An unexpected error occurred.');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <>
            <div className="p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-headline font-bold text-white tracking-tight">Identity Verification</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isPhoneLocked ? "default" : "secondary"} className={cn("text-[8px] font-black uppercase tracking-widest", isPhoneLocked ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                                {isPhoneLocked ? "Neural Link Verified" : "Verification Required"}
                            </Badge>
                        </div>
                    </div>
                    {isPhoneLocked && (
                        <Button type="button" variant="outline" onClick={() => setIsUpdateConfirmOpen(true)} className="h-9 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest px-4">Change</Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-4">
                    <FormField control={form.control} name="countryCode" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-zinc-400 font-bold uppercase tracking-widest text-[9px] ml-1">Protocol</FormLabel>
                            <FormControl><Input {...field} disabled={isPhoneLocked} className="bg-black/20 border-white/5 text-white h-11" /></FormControl>
                            <FormMessage className="text-red-500 text-[10px]" />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-zinc-400 font-bold uppercase tracking-widest text-[9px] ml-1">Neural ID (Phone)</FormLabel>
                            <FormControl>
                                <div className="flex gap-2">
                                    <Input {...field} disabled={isPhoneLocked} className="bg-black/20 border-white/5 text-white h-11" />
                                    {!isPhoneLocked && !otpSent && (
                                        <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isVerifying || !hasSufficientTokens} className="h-11 border-white/10 text-primary hover:bg-primary/5 text-[10px] font-bold uppercase tracking-widest px-6 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                                        </Button>
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage className="text-red-500 text-[10px]" />
                        </FormItem>
                    )} />
                </div>

                {verificationError && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest border border-red-500/20 bg-red-500/5 p-3 rounded-xl">{verificationError}</p>}

                {otpSent && !isPhoneLocked && (
                    <div className="pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <FormItem className="space-y-4">
                            <FormLabel className="text-center block text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Neural Verification Code</FormLabel>
                            <div className="flex items-center gap-3">
                                <FormControl>
                                    <Input type="tel" maxLength={6} placeholder="ENTER 6-DIGIT CODE" value={otp} onChange={(e) => setOtp(e.target.value)} className="bg-black/40 border-white/10 text-white text-center font-mono text-lg tracking-[0.5em] h-12" />
                                </FormControl>
                                <Button type="button" onClick={handleConfirmCode} disabled={isVerifying || otp.length !== 6} className="h-12 px-8 bg-emerald-600 text-white font-bold uppercase tracking-widest hover:bg-emerald-500">
                                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                                </Button>
                            </div>
                            <FormDescription className="text-zinc-400 text-[10px]">Checking WhatsApp for OTP...</FormDescription>
                        </FormItem>
                    </div>
                )}
            </div>

            <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Change Mobile Number?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed">
                            Changing your phone number requires new verification via WhatsApp.
                            This costs <span className="text-primary font-bold">{mobileVerificationCost} tokens</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setIsPhoneLocked(false); setOtpSent(false); setVerificationError(null); setIsUpdateConfirmOpen(false); }} className="bg-primary text-[#010a05] font-bold uppercase tracking-widest text-[10px] h-10 px-8">Confirm Change</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
