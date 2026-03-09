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
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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
  <>
    <Skeleton className="mb-6 h-9 w-48" />
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  </>
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
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Update your personal information. This will be visible to hosts when you check in.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="mb-8 flex items-center gap-6">
                    <Avatar className="h-24 w-24 border-2 border-primary/10">
                      <AvatarImage src={userProfile?.photo_url} alt={userProfile?.name} />
                      <AvatarFallback className="text-3xl">
                        {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : userProfile?.name ? userProfile.name.charAt(0) : <User className="h-8 w-8" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Label htmlFor="photo-upload">Profile Photo</Label>
                      <Input id="photo-upload" type="file" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} disabled={isUploading} className="max-w-xs" />
                      <p className="text-xs text-muted-foreground">PNG, JPG or GIF. 5MB max.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your Name" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Your Company" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />

                    <div className="md:col-span-2">
                      <div className="flex items-start gap-2">
                        <FormField control={form.control} name="countryCode" render={({ field }) => (
                          <FormItem className="w-24"><FormLabel>Code</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem className="flex-1"><FormLabel>Mobile Number {!isPhoneLocked && <span className="text-xs font-normal text-muted-foreground ml-1">(Enter your {settings?.phone_number_length || '...'} digit phone number)</span>}</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} disabled={isPhoneLocked} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="pt-8">
                          {isPhoneLocked ? (
                            <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md h-10"><ShieldCheck className="h-4 w-4" /><span>Verified</span></div>
                          ) : (
                            <Button type="button" onClick={handleSendVerificationCode} disabled={isVerifying || !hasSufficientTokens}>{isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify</Button>
                          )}
                        </div>
                        {isPhoneLocked && <div className="pt-8"><Button type="button" onClick={() => setIsUpdateConfirmOpen(true)}>Update</Button></div>}
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">{isPhoneLocked ? 'Your number is verified. Click "Update" to change it.' : `Verification costs ${mobileVerificationCost} tokens. The verification code will be received on WhatsApp.`}</p>
                      {(!hasSufficientTokens && !userProfile?.is_verified) && <p className="text-sm font-medium text-destructive">Insufficient tokens to verify.</p>}
                      {verificationError && <p className="text-sm font-medium text-destructive">{verificationError}</p>}
                      {otpSent && !isPhoneLocked && (
                        <div className="rounded-lg border bg-muted/50 p-4 mt-4">
                          <FormItem><FormLabel>Enter Verification Code</FormLabel><div className="flex items-center gap-2"><FormControl><Input type="tel" maxLength={6} placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} /></FormControl><Button type="button" onClick={handleConfirmCode} disabled={isVerifying || otp.length !== 6}>{isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</Button></div><FormDescription>A code has been sent to your WhatsApp.</FormDescription></FormItem>
                        </div>
                      )}
                    </div>

                    <FormField control={form.control} name="cityId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Input placeholder="Search cities..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                        <ScrollArea className="h-32 w-full rounded-md border mt-2">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="p-4">
                              {(filteredCities ?? []).map((city) => (
                                <div key={city.id} className="mb-2 flex items-center space-x-3">
                                  <RadioGroupItem value={city.id} id={`city-${city.id}`} />
                                  <Label htmlFor={`city-${city.id}`} className="font-normal capitalize">{city.name}, <span className="text-muted-foreground text-xs">{city.stateName}</span></Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          {(filteredCities ?? []).length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No cities match your search.</p>}
                        </ScrollArea>
                        <FormMessage />
                      </FormItem>
                    )}
                    />
                  </div>

                  <Separator />

                  <FormField control={form.control} name="products" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /><span>Products You Deal In</span></FormLabel>
                      <FormDescription>Add up to 10 products or services you offer.</FormDescription>
                      <div className="flex items-center gap-2">
                        <Input placeholder="e.g., Industrial Machinery" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProduct(); } }} />
                        <Button type="button" variant="outline" onClick={handleAddProduct} disabled={!newProduct.trim() || (field.value?.length ?? 0) >= 10}><Plus className="mr-2 h-4 w-4" />Add</Button>
                      </div>
                      <div className="space-y-2 pt-2">
                        {field.value && field.value.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {field.value.map((product) => (
                              <Badge key={product} variant="secondary" className="pl-3">{product}<button type="button" onClick={() => handleRemoveProduct(product)} className="ml-2 rounded-full p-0.5 text-secondary-foreground/50 hover:bg-destructive/20 hover:text-destructive"><X className="h-3 w-3" /><span className="sr-only">Remove {product}</span></button></Badge>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground text-center py-2">No products added yet.</p>}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                  />

                  <Separator />

                  {userProfile?.is_agent && (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium">Agent Financial Details (KYC)</h3>
                          {userProfile.kyc_verified ? (
                            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Verified</Badge>
                          ) : (
                            <Badge variant="secondary">Pending Verification</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">These details are required for processing your commission payouts. Verification is done manually by admin.</p>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <FormField control={form.control} name="agent_payout_upi" render={({ field }) => (
                            <FormItem>
                              <FormLabel>UPI ID for Payouts</FormLabel>
                              <FormControl><Input placeholder="yourname@upi" {...field} disabled={userProfile.kyc_verified} /></FormControl>
                              <FormDescription>Commission will be sent to this UPI ID.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="pan_number" render={({ field }) => (
                            <FormItem>
                              <FormLabel>PAN Number</FormLabel>
                              <FormControl><Input placeholder="ABCDE1234F" {...field} className="uppercase" disabled={userProfile.kyc_verified} /></FormControl>
                              <FormDescription>Required for TDS compliance (Income Tax).</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        {userProfile.kyc_verified && (
                          <div className="rounded-md bg-emerald-50 p-4 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                            <p className="text-sm text-emerald-800 dark:text-emerald-400">
                              Your financial details are verified and locked. Contact support if you need to change them.
                            </p>
                          </div>
                        )}
                      </div>
                      <Separator />
                    </>
                  )}

                  <div className="space-y-4">
                    <FormField control={form.control} name="vehicles" render={() => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-lg"><Car className="h-5 w-5 text-primary" /><span>Manage Your Vehicles</span></FormLabel>
                        <FormDescription>Select your primary vehicle for check-ins.</FormDescription>
                        <div className="space-y-2 pt-2">
                          <FormField control={form.control} name="selected_vehicle_number" render={({ field }) => (
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="space-y-2">
                              {vehicleFields.map((vehicle, index) => (
                                <div key={vehicle.id} className="flex items-center justify-between rounded-md border p-3">
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem value={vehicle.number} id={`vehicle-${index}`} />
                                    <Label htmlFor={`vehicle-${index}`} className="flex items-center gap-2 font-normal cursor-pointer"><Badge variant="outline" className="capitalize w-16 justify-center">{vehicle.type}</Badge><span className="font-mono text-base">{vehicle.number}</span></Label>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveVehicle(index)}><X className="h-4 w-4" /><span className="sr-only">Remove vehicle</span></Button>
                                </div>
                              ))}
                            </RadioGroup>
                          )}
                          />
                          {vehicleFields.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No vehicles added yet.</p>}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                    />

                    <div className="space-y-2">
                      <FormLabel>Add New Vehicle</FormLabel>
                      <div className="flex items-center gap-2">
                        <Select value={newVehicleType} onValueChange={(value) => setNewVehicleType(value as any)}><SelectTrigger className="w-[120px]"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="walking">Walking</SelectItem><SelectItem value="car">Car</SelectItem><SelectItem value="bike">Bike</SelectItem><SelectItem value="tempo">Tempo</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                        <Input placeholder="Vehicle Number" value={newVehicleNumber} onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())} disabled={newVehicleType === 'walking'} />
                        <Button type="button" variant="outline" onClick={handleAddVehicle}><Plus className="mr-2 h-4 w-4" /> Add</Button>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Change Phone Number?</AlertDialogTitle><AlertDialogDescription>This will require you to re-verify your number via WhatsApp. This action will cost {mobileVerificationCost} tokens. Are you sure you want to proceed?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setIsPhoneLocked(false); setOtpSent(false); setVerificationError(null); setIsUpdateConfirmOpen(false); }}>Yes, Continue</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <LinkedAccounts />
        </>
      )}
    </div>
  );
}

