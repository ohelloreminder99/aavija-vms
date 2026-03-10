'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Upload,
  User,
  Package,
  Plus,
  X,
  Car,
  Coins,
  Search,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

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
import { Input } from '@/components/ui/input';
import { useSupabase } from '@/supabase';
import {
  useUserProfile,
  updateUserProfile,
  UserProfile,
} from '@/services/user-service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettings } from '@/services/settings-service';
import { useCities } from '@/services/city-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { sendWhatsAppOtp, verifyWhatsAppOtp } from './actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LinkedAccounts } from './LinkedAccounts';
import { updatePayoutDetails } from '@/services/agent-service';

const SkeletonProfile = () => (
  <div className="space-y-6">
    <Skeleton className="h-10 w-48 bg-white/5" />
    <Card className="glass-card border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-white/[0.01]" />
      <CardHeader className="relative z-10 border-b border-white/5 pb-8">
        <Skeleton className="h-8 w-1/3 bg-white/5" />
        <Skeleton className="mt-4 h-4 w-2/3 bg-white/5" />
      </CardHeader>
      <CardContent className="space-y-8 pt-8 relative z-10">
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full bg-white/5" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-white/5" />
            <Skeleton className="h-10 w-64 bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2"><Skeleton className="h-4 w-20 bg-white/5" /><Skeleton className="h-11 w-full bg-white/5" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-20 bg-white/5" /><Skeleton className="h-11 w-full bg-white/5" /></div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const vehicleSchema = z.object({
  type: z.enum(['car', 'bike', 'tempo', 'other', 'walking']),
  number: z.string().min(1, 'Vehicle number is required.'),
});

export default function ProfilePage() {
  const { user } = useSupabase();
  const router = useRouter();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile(user?.id);
  const { data: settings, isLoading: areSettingsLoading } = useSettings();
  const { data: cities, isLoading: areCitiesLoading } = useCities();

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [newProduct, setNewProduct] = React.useState('');
  const [newVehicleNumber, setNewVehicleNumber] = React.useState('');
  const [newVehicleType, setNewVehicleType] = React.useState<'car' | 'bike' | 'tempo' | 'other' | 'walking'>('car');

  // State for phone verification
  const [isPhoneLocked, setIsPhoneLocked] = React.useState(true);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState('');
  const [verificationError, setVerificationError] = React.useState<
    string | null
  >(null);
  const [citySearch, setCitySearch] = React.useState('');

  const isLoading =
    isProfileLoading || areSettingsLoading || areCitiesLoading;

  const mobileVerificationCost = settings?.mobile_verification_cost ?? 0;
  const hasSufficientTokens = (userProfile?.token_balance_visitor ?? 0) >= mobileVerificationCost;

  const profileSchema = React.useMemo(() => {
    const phoneLength = settings?.phone_number_length;
    const phoneSchema = phoneLength
      ? z.string().length(phoneLength, { message: `Phone number must be ${phoneLength} digits.` }).regex(/^[0-9]+$/, { message: 'Phone number must contain only digits.' })
      : z.string().min(5, { message: 'Please enter a valid phone number.' }).regex(/^[0-9]+$/, { message: 'Phone number must contain only digits.' });

    return z.object({
      name: z.string().min(2, 'Name must be at least 2 characters.'),
      companyName: z.string().optional(),
      cityId: z.string().min(1, 'Please select a city.'),
      countryCode: z.string(),
      phone: phoneSchema,
      products: z.array(z.string()).max(10, 'You can add a maximum of 10 products.').optional(),
      vehicles: z.array(vehicleSchema).optional(),
      selected_vehicle_number: z.string().nullable().optional(),
      // Agent KYC
      agent_payout_upi: z.string().optional(),
      pan_number: z.string().optional(),
    });
  }, [settings?.phone_number_length]);

  type ProfileFormValues = z.infer<typeof profileSchema>;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      companyName: '',
      cityId: '',
      countryCode: '+91',
      phone: '',
      products: [],
      vehicles: [],
      selected_vehicle_number: null,
      agent_payout_upi: '',
      pan_number: '',
    },
  });

  const { fields: vehicleFields, append: appendVehicle, remove: removeVehicle } = useFieldArray({
    control: form.control,
    name: "vehicles",
  });

  const filteredCities = React.useMemo(
    () =>
      cities?.filter((c) =>
        c.name.toLowerCase().includes(citySearch.toLowerCase())
      ) || [],
    [cities, citySearch]
  );

  React.useEffect(() => {
    if (newVehicleType === 'walking') {
      setNewVehicleNumber('WALKING');
    } else {
      if (newVehicleNumber === 'WALKING') {
        setNewVehicleNumber('');
      }
    }
  }, [newVehicleType, newVehicleNumber]);

  React.useEffect(() => {
    if (userProfile) {
      form.reset({
        name: userProfile.name || '',
        companyName: userProfile.companyName || '',
        cityId: userProfile.cityId || '',
        countryCode: userProfile.countryCode || settings?.default_country_code || '+91',
        phone: userProfile.phone || '',
        products: userProfile.products || [],
        vehicles: userProfile.vehicles || [],
        selected_vehicle_number: userProfile.selected_vehicle_number || null,
        agent_payout_upi: userProfile.agent_payout_upi || '',
        pan_number: userProfile.pan_number || '',
      });
      setIsPhoneLocked(userProfile.is_verified);
    }
  }, [userProfile, form, settings]);

  const handleAddProduct = () => {
    if (newProduct.trim() === '') return;
    const currentProducts = form.getValues('products') || [];
    if (currentProducts.length >= 10) {
      toast({ variant: 'destructive', title: 'Limit Reached', description: 'You can only add up to 10 products.' });
      return;
    }
    if (currentProducts.includes(newProduct.trim())) {
      toast({ variant: 'destructive', title: 'Duplicate Product', description: 'This product is already in your list.' });
      return;
    }
    form.setValue('products', [...currentProducts, newProduct.trim()]);
    setNewProduct('');
  };

  const handleRemoveProduct = (productToRemove: string) => {
    const currentProducts = form.getValues('products') || [];
    form.setValue('products', currentProducts.filter((p) => p !== productToRemove));
  };

  const handleAddVehicle = () => {
    if (newVehicleNumber.trim() === '') {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Vehicle number cannot be empty.' });
      return;
    }
    const currentVehicles = form.getValues('vehicles') || [];
    if (currentVehicles.find(v => v.number.toLowerCase() === newVehicleNumber.trim().toLowerCase())) {
      toast({ variant: 'destructive', title: 'Duplicate Vehicle', description: 'This vehicle number is already in your list.' });
      return;
    }
    appendVehicle({ type: newVehicleType, number: newVehicleNumber.trim().toUpperCase() });
    setNewVehicleNumber('');
  };

  const handleRemoveVehicle = (index: number) => {
    const vehicleToRemove = (form.getValues('vehicles') || [])[index];
    if (vehicleToRemove && form.getValues('selected_vehicle_number') === vehicleToRemove.number) {
      form.setValue('selected_vehicle_number', null);
    }
    removeVehicle(index);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload an image smaller than 5MB.' });
      return;
    }

    setIsUploading(true);

    const resizeImage = (file: File): Promise<File> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
              const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp', lastModified: Date.now() });
              resolve(resizedFile);
            }, 'image/webp', 0.8);
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });
    };

    try {
      const resizedFile = await resizeImage(file);
      const uniqueFilename = `${user.id}-${Date.now()}.webp`;
      const filePath = `${user.id}/profile/${uniqueFilename}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from('users').upload(filePath, resizedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('users').getPublicUrl(filePath);

      await updateUserProfile(user.id, { photo_url: publicUrl });
      toast({ title: 'Photo updated!', description: 'Your new profile photo has been saved.' });
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'An unexpected error occurred while resizing or uploading.' });
    } finally { setIsUploading(false); }
  };

  const handleSendVerificationCode = async () => {
    if (!user) return;
    const phone = form.getValues('phone');
    const countryCode = form.getValues('countryCode');
    const isPhoneValid = await form.trigger(['phone', 'countryCode']);
    if (!isPhoneValid) { form.setFocus('phone'); return; }
    if (!hasSufficientTokens) { setVerificationError(`Insufficient tokens. You need ${mobileVerificationCost} tokens to verify.`); return; }
    setIsVerifying(true); setVerificationError(null);
    const result = await sendWhatsAppOtp({ userId: user.id, phone, countryCode: countryCode });
    setIsVerifying(false);
    if (result.success) { setOtpSent(true); toast({ title: 'OTP Sent', description: 'Please check your WhatsApp for the verification code.' }); }
    else { setVerificationError(result.error || 'An unknown error occurred.'); }
  };

  const handleConfirmCode = async () => {
    if (!user) return;
    const enteredPhone = form.getValues('phone');
    const enteredCountryCode = form.getValues('countryCode');
    if (otp.length !== 6) { setVerificationError('OTP must be 6 digits long.'); return; }
    setIsVerifying(true); setVerificationError(null);
    const result = await verifyWhatsAppOtp({ userId: user.id, otp, phone: enteredPhone, countryCode: enteredCountryCode });
    setIsVerifying(false);
    if (result.success) {
      toast({ title: 'Success!', description: result.message });
      setOtpSent(false);
      setOtp('');
      setIsPhoneLocked(true);   // lock field immediately without waiting for realtime
      router.refresh();          // force server re-render so is_verified=true propagates instantly
    } else {
      setVerificationError(result.error || 'Failed to verify OTP.');
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not available.' });
      return;
    }
    setIsSubmitting(true);
    const phoneChanged = userProfile && data.phone !== userProfile.phone;
    try {
      const selectedCityObj = cities?.find(c => c.id === data.cityId);
      const dataToUpdate: any = {
        name: data.name,
        companyName: data.companyName,
        cityId: data.cityId,
        city: selectedCityObj?.name || 'Unknown',
        city_state: selectedCityObj?.stateName || 'Unknown',
        countryCode: data.countryCode,
        products: data.products,
        vehicles: data.vehicles,
        selected_vehicle_number: data.selected_vehicle_number,
        phone: data.phone,
      };
      if (phoneChanged) {
        dataToUpdate.is_verified = false;
        setIsPhoneLocked(false);
      }
      if (userProfile?.is_agent) {
        await updatePayoutDetails({
          agent_payout_upi: data.agent_payout_upi,
          pan_number: data.pan_number,
        });
      }
      toast({ title: phoneChanged ? 'Profile Updated & Phone Changed' : 'Profile Updated', description: 'Your changes have been saved successfully.' });
    } catch (error: any) {
      console.error('Profile update failed:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'An error occurred while saving your profile.' });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="container py-10">
      {isLoading ? <SkeletonProfile /> : (
        <>
          <div className="mb-6">
            <Button asChild variant="outline">
              <Link href="/dashboard/visitor">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
            <CardHeader className="relative z-10 border-b border-white/5 pb-8">
              <CardTitle className="text-3xl font-headline font-bold text-white tracking-tight">Identity <span className="text-primary/80">Profile</span></CardTitle>
              <CardDescription className="text-zinc-400 max-w-xl leading-relaxed mt-2">Update your personal biometric and operational data. This will be verified by hosts during facility entry.</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="mb-8 flex items-center gap-8 p-6 bg-white/[0.02] border border-white/5 rounded-3xl group/avatar">
                    <div className="relative">
                      <Avatar className="h-28 w-28 border-2 border-white/5 group-hover/avatar:border-primary/50 transition-all duration-500 shadow-2xl">
                        <AvatarImage src={userProfile?.photo_url} alt={userProfile?.name} className="object-cover" />
                        <AvatarFallback className="bg-white/5 text-4xl text-zinc-500 font-bold">
                          {isUploading ? <Loader2 className="h-10 w-10 animate-spin text-primary/40" /> : userProfile?.name ? userProfile.name.charAt(0) : <User className="h-10 w-10" />}
                        </AvatarFallback>
                      </Avatar>
                      {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-sm"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                    </div>
                    <div className="space-y-3 flex-1">
                      <Label htmlFor="photo-upload" className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Biometric Visual</Label>
                      <div className="flex items-center gap-4">
                        <Input id="photo-upload" type="file" accept="image/png, image,jpeg, image/gif" onChange={handleFileChange} disabled={isUploading} className="max-w-[240px] bg-white/5 border-white/10 text-white text-xs h-9 cursor-pointer hover:bg-white/10 transition-colors" />
                        {isUploading && <span className="text-xs text-primary animate-pulse font-bold tracking-widest uppercase">Syncing...</span>}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">Support: WEBP, PNG, JPG (5MB Max)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Neural Designation</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Full Name" {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11" />
                        </FormControl>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Affiliated Org</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company" {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11" />
                        </FormControl>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )} />

                    <div className="md:col-span-2 p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <FormField control={form.control} name="countryCode" render={({ field }) => (
                          <FormItem className="w-24">
                            <FormLabel className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Node Code</FormLabel>
                            <FormControl>
                              <Input {...field} disabled className="bg-white/5 border-white/10 text-zinc-500 h-11 text-center" />
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem className="flex-1 min-w-[200px]">
                            <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">
                              Signal Hash (Mobile)
                              {!isPhoneLocked && <span className="text-[9px] font-normal text-zinc-500 ml-2">({settings?.phone_number_length || '10'} digits required)</span>}
                            </FormLabel>
                            <FormControl>
                              <Input type="tel" placeholder="9876543210" {...field} disabled={isPhoneLocked} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11 font-mono tracking-wider" />
                            </FormControl>
                            <FormMessage className="text-red-500 text-[10px]" />
                          </FormItem>
                        )} />
                        <div className="flex gap-2">
                          {isPhoneLocked ? (
                            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black uppercase tracking-widest px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl h-11 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                              <ShieldCheck className="h-4 w-4" />
                              <span>Verified</span>
                            </div>
                          ) : (
                            <Button type="button" onClick={handleSendVerificationCode} disabled={isVerifying || !hasSufficientTokens} className="h-11 px-6 bg-primary text-white font-bold uppercase tracking-widest text-[10px] hover:bg-primary/90">
                              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Initialize Link
                            </Button>
                          )}
                          {isPhoneLocked && <Button type="button" variant="outline" onClick={() => setIsUpdateConfirmOpen(true)} className="h-11 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest">Reconfigure</Button>}
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">
                        {isPhoneLocked ? 'Communication link secured.' : `Verification protocol costs ${mobileVerificationCost} neural credits. Secure code transmitted via WhatsApp.`}
                      </p>
                      {(!hasSufficientTokens && !userProfile?.is_verified) && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Credit Depletion: Insufficient tokens for uplink.</p>}
                      {verificationError && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{verificationError}</p>}
                      {otpSent && !isPhoneLocked && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                          <FormItem>
                            <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Verification Pulse</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input type="tel" maxLength={6} placeholder="ENTER 6-DIGIT CODE" value={otp} onChange={(e) => setOtp(e.target.value)} className="bg-black/40 border-white/10 text-white text-center font-mono text-lg tracking-[0.5em] h-12" />
                              </FormControl>
                              <Button type="button" onClick={handleConfirmCode} disabled={isVerifying || otp.length !== 6} className="h-12 px-8 bg-emerald-600 text-white font-bold uppercase tracking-widest hover:bg-emerald-500">
                                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                              </Button>
                            </div>
                            <FormDescription className="text-zinc-500 text-[10px]">Monitoring WhatsApp for incoming transmission...</FormDescription>
                          </FormItem>
                        </div>
                      )}
                    </div>

                    <FormField control={form.control} name="cityId" render={({ field }) => (
                      <FormItem className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px] mb-4 block">Operational Sector (City)</FormLabel>
                        <div className="relative group/search mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within/search:text-primary transition-colors" />
                          <Input placeholder="Filter sectors..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} className="pl-10 bg-black/20 border-white/5 text-white placeholder:text-zinc-700 h-10 text-sm" />
                        </div>
                        <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/20">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="p-4 space-y-1">
                              {(filteredCities ?? []).map((city) => (
                                <div key={city.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group/item">
                                  <RadioGroupItem value={city.id} id={`city-${city.id}`} className="border-white/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                                  <Label htmlFor={`city-${city.id}`} className="font-medium text-zinc-400 group-hover/item:text-white transition-colors capitalize text-sm flex-1 cursor-pointer">
                                    {city.name} <span className="text-[10px] text-zinc-600 uppercase tracking-tighter ml-2">{city.stateName}</span>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          {(filteredCities ?? []).length === 0 && <p className="py-12 text-center text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Sector Not Found</p>}
                        </ScrollArea>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )}
                    />
                  </div>

                  <Separator className="bg-white/5 h-[1px]" />

                  <FormField control={form.control} name="products" render={({ field }) => (
                    <FormItem className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                      <FormLabel className="flex items-center gap-2 text-zinc-300 font-bold uppercase tracking-widest text-[10px] mb-4">
                        <Package className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                        <span>Inventory Expertise</span>
                      </FormLabel>
                      <FormDescription className="text-zinc-500 text-[10px] mb-4">Add up to 10 products or services you offer for neural matching.</FormDescription>
                      <div className="flex items-center gap-2">
                        <Input placeholder="e.g., Industrial Machinery" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProduct(); } }} className="bg-black/20 border-white/10 text-white placeholder:text-zinc-700 h-10" />
                        <Button type="button" variant="outline" onClick={handleAddProduct} disabled={!newProduct.trim() || (field.value?.length ?? 0) >= 10} className="h-10 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest px-6">Add</Button>
                      </div>
                      <div className="space-y-4 pt-4">
                        {field.value && field.value.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {field.value.map((product) => (
                              <Badge key={product} variant="secondary" className="pl-3 py-1.5 bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 transition-colors">
                                {product}
                                <button type="button" onClick={() => handleRemoveProduct(product)} className="ml-2 rounded-full p-0.5 text-zinc-500 hover:text-red-500 transition-colors">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.2em] text-center py-6 border border-dashed border-white/5 rounded-2xl">No expertise indexed.</p>}
                      </div>
                      <FormMessage className="text-red-500 text-[10px]" />
                    </FormItem>
                  )}
                  />

                  <Separator className="bg-white/5 h-[1px]" />

                  {userProfile?.is_agent && (
                    <>
                      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Coins className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-headline font-bold text-white tracking-tight">Agent Payout Protocol</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={userProfile.kyc_verified ? "default" : "secondary"} className={cn("text-[8px] font-black uppercase tracking-widest", userProfile.kyc_verified ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                                {userProfile.kyc_verified ? "Verified" : "Pending Sync"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase leading-relaxed max-w-md">Financial credentials are required for commission distribution. Manual verification by sector admin is mandatory.</p>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-4">
                          <FormField control={form.control} name="agent_payout_upi" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">UPI Link</FormLabel>
                              <FormControl><Input placeholder="yourname@upi" {...field} disabled={userProfile.kyc_verified} className="bg-black/20 border-white/5 text-white h-11" /></FormControl>
                              <FormMessage className="text-red-500 text-[10px]" />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="pan_number" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">PAN Hash</FormLabel>
                              <FormControl><Input placeholder="ABCDE1234F" {...field} className="uppercase bg-black/20 border-white/5 text-white h-11" disabled={userProfile.kyc_verified} /></FormControl>
                              <FormMessage className="text-red-500 text-[10px]" />
                            </FormItem>
                          )} />
                        </div>
                        {userProfile.kyc_verified && (
                          <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter text-center">
                              Financial records locked and secured. Contact support for reconfiguration.
                            </p>
                          </div>
                        )}
                      </div>
                      <Separator className="bg-white/5 h-[1px]" />
                    </>
                  )}

                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-6">
                    <FormField control={form.control} name="vehicles" render={() => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-3 text-zinc-300 font-headline font-bold uppercase tracking-widest text-[10px]">
                          <Car className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                          <span>Fleet Management</span>
                        </FormLabel>
                        <FormDescription className="text-zinc-500 text-[10px]">Synchronize your primary transport for rapid facility entry.</FormDescription>
                        <div className="space-y-3 pt-4">
                          <FormField control={form.control} name="selected_vehicle_number" render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="space-y-3">
                              {vehicleFields.map((vehicle, index) => (
                                <div key={vehicle.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4 hover:border-white/10 transition-all group/vehicle">
                                  <div className="flex items-center gap-4">
                                    <RadioGroupItem value={vehicle.number} id={`vehicle-${index}`} className="border-white/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                                    <Label htmlFor={`vehicle-${index}`} className="flex items-center gap-3 font-normal cursor-pointer">
                                      <Badge variant="outline" className="capitalize w-20 justify-center bg-white/5 border-white/10 text-zinc-400 group-hover/vehicle:text-white transition-colors">{vehicle.type}</Badge>
                                      <span className="font-mono text-lg font-bold text-white tracking-widest group-hover/vehicle:text-primary transition-colors">{vehicle.number}</span>
                                    </Label>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" className="text-zinc-700 hover:text-red-500 hover:bg-red-500/5" onClick={() => handleRemoveVehicle(index)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </RadioGroup>
                          )}
                          />
                          {vehicleFields.length === 0 && <p className="text-center text-[10px] font-bold text-zinc-700 uppercase tracking-widest py-8 border border-dashed border-white/5 rounded-2xl">No transport linked.</p>}
                        </div>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )}
                    />

                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <FormLabel className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Deploy New Asset</FormLabel>
                      <div className="flex flex-wrap items-center gap-3">
                        <Select value={newVehicleType} onValueChange={(value) => setNewVehicleType(value as any)}>
                          <SelectTrigger className="w-[140px] bg-black/20 border-white/10 text-white h-10">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#020617] border-white/10 text-white">
                            <SelectItem value="walking">Walking</SelectItem>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="bike">Bike</SelectItem>
                            <SelectItem value="tempo">Tempo</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Vehicle Number" value={newVehicleNumber} onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())} disabled={newVehicleType === 'walking'} className="flex-1 min-w-[150px] bg-black/20 border-white/10 text-white placeholder:text-zinc-700 h-10 font-mono" />
                        <Button type="button" variant="outline" onClick={handleAddVehicle} className="h-10 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest px-6 ml-auto">
                          <Plus className="mr-2 h-4 w-4" /> Link
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-primary text-white font-black tracking-[0.2em] uppercase hover:bg-primary/90 shadow-[0_0_30px_rgba(59,130,246,0.3)] text-base">
                    {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
                    Synchronize Identity
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
            <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Reconfigure Link?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400 leading-relaxed">
                  Changing your signal hash (phone number) requires fresh biometric verification via WhatsApp.
                  This operation consumes <span className="text-primary font-bold">{mobileVerificationCost} neural units</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-6">
                <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setIsPhoneLocked(false); setOtpSent(false); setVerificationError(null); setIsUpdateConfirmOpen(false); }} className="bg-primary text-white font-bold uppercase tracking-widest text-[10px] h-10 px-8">Confirm Uplink</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <LinkedAccounts />
        </>
      )}
    </div>
  );
}

