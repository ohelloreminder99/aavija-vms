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
  UpdateableUserProfile,
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
import { VehicleManager } from './VehicleManager';
import { PhoneVerification } from './PhoneVerification';

const SkeletonProfile = () => (
  <div className="space-y-6">
    <Skeleton className="h-10 w-48 bg-white/5" />
    <Card className="glass-card border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#010a05]/95 backdrop-blur-3xl/[0.01]" />
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

  // State for phone verification
  const [isPhoneLocked, setIsPhoneLocked] = React.useState(true);
  const [citySearch, setCitySearch] = React.useState('');

  const isLoading =
    isProfileLoading || areSettingsLoading || areCitiesLoading;

  const mobileVerificationCost = settings?.mobile_verification_cost ?? 0;
  const hasSufficientTokens = (userProfile?.token_balance_visitor ?? 0) >= mobileVerificationCost;

  const profileSchema = React.useMemo(() => {
    const phoneLength = settings?.phone_number_length;
    const phoneSchema = phoneLength
      ? z.string()
        .regex(/^[1-9][0-9]*$/, { message: 'Phone number must contain only digits and cannot start with 0.' })
        .length(phoneLength, { message: `Phone number must be exactly ${phoneLength} digits.` })
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
      pan_card_url: z.string().optional(),
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
      pan_card_url: '',
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
        pan_card_url: userProfile.pan_card_url || '',
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



  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'pancard') => {
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
            // Higher quality for PAN Card
            const maxSize = type === 'avatar' ? 600 : 1200;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
              const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp', lastModified: Date.now() });
              resolve(resizedFile);
            }, 'image/webp', 0.85);
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });
    };

    try {
      const resizedFile = await resizeImage(file);
      const uniqueFilename = `${user.id}-${type}-${Date.now()}.webp`;
      const bucket = type === 'avatar' ? 'users' : 'kyc-documents';
      const filePath = `${user.id}/${type}/${uniqueFilename}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, resizedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

      if (type === 'avatar') {
        await updateUserProfile(user.id, { photo_url: publicUrl });
        toast({ title: 'Photo updated!', description: 'Your profile photo has been saved.' });
      } else {
        form.setValue('pan_card_url', publicUrl);
        toast({ title: 'PAN Card Uploaded', description: 'Photo captured and converted to WebP. Click Save to finalize.' });
      }
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error instanceof Error ? error.message : 'An error occurred during upload.' });
    } finally { setIsUploading(false); }
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
      const dataToUpdate: Partial<UpdateableUserProfile> & { is_verified?: boolean } = {
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
          pan_card_url: data.pan_card_url,
        });
      }
      toast({ title: phoneChanged ? 'Profile Updated & Phone Changed' : 'Profile Updated', description: 'Your changes have been saved successfully.' });
    } catch (error: unknown) {
      console.error('Profile update failed:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error instanceof Error ? error.message : 'An error occurred while saving your profile.' });
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
              <CardTitle className="text-3xl font-headline font-bold text-white tracking-tight">My <span className="text-primary/80">Profile</span></CardTitle>
              <CardDescription className="text-zinc-400 max-w-xl leading-relaxed mt-2">Update your personal and vehicle details for easier entry at any premise.</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 pt-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="mb-8 flex items-center gap-8 p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl group/avatar">
                    <div className="relative">
                      <Avatar className="h-28 w-28 border-2 border-white/5 group-hover/avatar:border-primary/50 transition-all duration-500 shadow-2xl">
                        <AvatarImage src={userProfile?.photo_url} alt={userProfile?.name} className="object-cover" />
                        <AvatarFallback className="bg-white/5 text-4xl text-zinc-400 font-bold">
                          {isUploading ? <Loader2 className="h-10 w-10 animate-spin text-primary/40" /> : userProfile?.name ? userProfile.name.charAt(0) : <User className="h-10 w-10" />}
                        </AvatarFallback>
                      </Avatar>
                      {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-sm"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                    </div>
                    <div className="space-y-3 flex-1">
                      <Label htmlFor="photo-upload" className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Profile Photo</Label>
                      <div className="flex items-center gap-4">
                        <Input id="photo-upload" type="file" accept="image/webp, image/png, image/jpeg" onChange={(e) => handleFileUpload(e, 'avatar')} disabled={isUploading} aria-label="Upload profile photo" className="max-w-[240px] bg-white/5 border-white/10 text-white text-xs h-9 cursor-pointer hover:bg-white/10 transition-colors" />
                        {isUploading && <span className="text-xs text-primary animate-pulse font-bold tracking-widest uppercase">Uploading...</span>}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-tight">Support: WEBP, PNG, JPG (5MB Max)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Full Name" {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-400 h-11" />
                        </FormControl>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company" {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-400 h-11" />
                        </FormControl>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )} />

                    <PhoneVerification
                      form={form}
                      isPhoneLocked={isPhoneLocked}
                      setIsPhoneLocked={setIsPhoneLocked}
                      userProfile={userProfile}
                      settings={settings}
                    />

                    <FormField control={form.control} name="cityId" render={({ field }) => (
                      <FormItem className="p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl">
                        <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px] mb-4 block">
                          City {field.value && (
                            <span className="text-primary ml-2 border-l border-white/10 pl-2">
                              {cities?.find(c => c.id === field.value)?.name}
                            </span>
                          )}
                        </FormLabel>
                        <div className="relative group/search mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within/search:text-primary transition-colors" />
                          <Input placeholder="Search city..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} aria-label="Search cities" className="pl-10 bg-black/20 border-white/5 text-white placeholder:text-zinc-400 h-10 text-sm" />
                        </div>
                        <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/20">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value ?? ''} className="p-4 space-y-1">
                              {(filteredCities ?? []).map((city) => (
                                <div key={city.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group/item">
                                  <RadioGroupItem value={city.id} id={`city-${city.id}`} className="border-white/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                                  <Label htmlFor={`city-${city.id}`} className="font-medium text-zinc-400 group-hover/item:text-white transition-colors capitalize text-sm flex-1 cursor-pointer">
                                    {city.name} <span className="text-[10px] text-zinc-400 uppercase tracking-tighter ml-2">{city.stateName}</span>
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          {(filteredCities ?? []).length === 0 && <p className="py-12 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">City Not Found</p>}
                        </ScrollArea>
                        <FormMessage className="text-red-500 text-[10px]" />
                      </FormItem>
                    )}
                    />
                  </div>

                  <Separator className="bg-white/5 h-[1px]" />

                  <FormField control={form.control} name="products" render={({ field }) => (
                    <FormItem className="p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl">
                      <FormLabel className="flex items-center gap-2 text-zinc-300 font-bold uppercase tracking-widest text-[10px] mb-4">
                        <Package className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                        <span>Specialization</span>
                      </FormLabel>
                      <FormDescription className="text-zinc-400 text-[10px] mb-4">Add items or services you offer to help people find you.</FormDescription>
                      <div className="flex items-center gap-2">
                        <Input placeholder="e.g., Industrial Machinery" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProduct(); } }} className="bg-black/20 border-white/10 text-white placeholder:text-zinc-400 h-10" />
                        <Button type="button" variant="outline" onClick={handleAddProduct} disabled={!newProduct.trim() || (field.value?.length ?? 0) >= 10} className="h-10 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest px-6">Add</Button>
                      </div>
                      <div className="space-y-4 pt-4">
                        {field.value && field.value.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {field.value.map((product: string) => (
                              <Badge key={product} variant="secondary" className="pl-3 py-1.5 bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 transition-colors">
                                {product}
                                <button type="button" onClick={() => handleRemoveProduct(product)} className="ml-2 rounded-full p-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] text-center py-6 border border-dashed border-white/5 rounded-2xl">No items added.</p>}
                      </div>
                      <FormMessage className="text-red-500 text-[10px]" />
                    </FormItem>
                  )}
                  />

                  <Separator className="bg-white/5 h-[1px]" />

                  {userProfile?.is_agent && (
                    <>
                      <div className="p-6 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 rounded-3xl space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Coins className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-headline font-bold text-white tracking-tight">Payment Details</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={userProfile.kyc_verified ? "default" : "secondary"} className={cn("text-[8px] font-black uppercase tracking-widest", userProfile.kyc_verified ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                                {userProfile.kyc_verified ? "Verified" : "Pending Sync"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium uppercase leading-relaxed max-w-md">Add your UPI and PAN for commission payments. Manual verification by admin is required.</p>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-4">
                          <FormField control={form.control} name="agent_payout_upi" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-400 font-bold uppercase tracking-widest text-[9px]">UPI ID</FormLabel>
                              <FormControl><Input placeholder="yourname@upi" {...field} disabled={userProfile.kyc_verified} className="bg-black/20 border-white/5 text-white h-11" /></FormControl>
                              <FormMessage className="text-red-500 text-[10px]" />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="pan_number" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-zinc-400 font-bold uppercase tracking-widest text-[9px]">PAN Number</FormLabel>
                              <FormControl><Input placeholder="ABCDE1234F" {...field} className="uppercase bg-black/20 border-white/5 text-white h-11" disabled={userProfile.kyc_verified} /></FormControl>
                              <FormMessage className="text-red-500 text-[10px]" />
                            </FormItem>
                          )} />
                        </div>

                        <FormField control={form.control} name="pan_card_url" render={({ field }) => (
                          <FormItem className="pt-4">
                            <FormLabel className="text-zinc-400 font-bold uppercase tracking-widest text-[9px]">PAN Card Photo (WebP)</FormLabel>
                            <div className="flex items-center gap-4 mt-2">
                              {field.value && (
                                <div className="h-16 w-24 rounded-lg border border-white/10 overflow-hidden bg-black/20">
                                  <img src={field.value} alt="PAN Card Preview" className="h-full w-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1">
                                <FormControl>
                                  <Input 
                                    type="file" 
                                    accept="image/webp, image/png, image/jpeg" 
                                    disabled={userProfile.kyc_verified || isUploading}
                                    onChange={(e) => handleFileUpload(e, 'pancard')}
                                    className="bg-black/20 border-white/5 text-white h-10 text-xs" 
                                  />
                                </FormControl>
                                <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-tighter">Automatic WebP conversion enabled</p>
                              </div>
                            </div>
                            <FormMessage className="text-red-500 text-[10px]" />
                          </FormItem>
                        )} />
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




                  <VehicleManager
                    form={form}
                    vehicleFields={vehicleFields}
                    appendVehicle={appendVehicle}
                    removeVehicle={removeVehicle}
                  />

                  <Button type="submit" disabled={isSubmitting} className="w-full h-14 bg-primary text-[#010a05] font-black tracking-[0.2em] uppercase hover:bg-primary/90 shadow-[0_0_30px_rgba(16,185,129,0.3)] text-base">
                    {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
                    Save Profile
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>


          <LinkedAccounts />
        </>
      )}
    </div>
  );
}

