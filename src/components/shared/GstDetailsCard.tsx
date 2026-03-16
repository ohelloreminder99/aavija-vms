'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { useStates } from '@/services/state-service';

const gstSchema = z.object({
  legalName: z.string().min(2, 'Legal name is required for billing.'),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: "Invalid GSTIN format (e.g., 27ABCDE1234F1Z5).",
  }).or(z.literal('')),
  billingAddress: z.string().min(5, 'Billing address is too short.'),
  billingState: z.string().min(1, 'Please select your registered state.'),
});

type GstFormValues = z.infer<typeof gstSchema>;

interface GstDetailsCardProps {
  target: {
    type: 'user' | 'premise';
    id: string;
  };
  initialData?: {
    legalName?: string;
    gstNumber?: string;
    billingAddress?: string;
    billingState?: string;
  };
  onSuccess?: () => void;
}

export function GstDetailsCard({ target, initialData, onSuccess }: GstDetailsCardProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: states, isLoading: isLoadingStates } = useStates();

  const form = useForm<GstFormValues>({
    resolver: zodResolver(gstSchema),
    defaultValues: {
      legalName: initialData?.legalName || '',
      gstNumber: initialData?.gstNumber || '',
      billingAddress: initialData?.billingAddress || '',
      billingState: initialData?.billingState || '',
    },
  });

  // Sync with initialData when it changes
  React.useEffect(() => {
    if (initialData) {
      form.reset({
        legalName: initialData.legalName || '',
        gstNumber: initialData.gstNumber || '',
        billingAddress: initialData.billingAddress || '',
        billingState: initialData.billingState || '',
      });
    }
  }, [initialData, form]);

  const onSubmit = async (data: GstFormValues) => {
    if (!target.id) return;

    setIsSubmitting(true);
    try {
      const tableName = target.type === 'user' ? 'users' : 'premises';

      const { error } = await supabase.from(tableName).update({
        legalName: data.legalName,
        gstNumber: data.gstNumber.toUpperCase(),
        billingAddress: data.billingAddress,
        billingState: data.billingState,
      }).eq('id', target.id);

      if (error) throw error;

      toast({
        title: 'GST Details Updated',
        description: 'Your tax information has been saved successfully.',
      });
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not save GST details.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingStates) {
    return (
      <Card className="glass-card border-white/5 relative overflow-hidden h-96 flex flex-col items-center justify-center gap-4">
        <div className="absolute inset-0 mesh-obsidian opacity-20" />
        <Loader2 className="h-10 w-10 animate-spin text-primary/40 relative z-10" />
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse relative z-10">Syncing Regions...</p>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none" />
      <CardHeader className="relative z-10 border-b border-white/5 pb-8">
        <CardTitle className="flex items-center gap-3 text-white text-2xl font-headline font-bold tracking-tight">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
            <FileText className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          GST & Billing Details
        </CardTitle>
        <CardDescription className="text-zinc-400 mt-2">
          Save your billing details for GST invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Name (as per GST)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sunil Kumar" {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11" />
                  </FormControl>
                  <FormDescription className="text-zinc-500 text-[10px]">Official name for your invoices.</FormDescription>
                  <FormMessage className="text-red-500 text-[10px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gstNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">GST Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 27AAAAA0000A1Z5" {...field} className="uppercase bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-11" />
                  </FormControl>
                  <FormDescription className="text-zinc-500 text-[10px]">Your GST identification number.</FormDescription>
                  <FormMessage className="text-red-500 text-[10px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Registered State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-11">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-[#010a05] border-white/10 text-white">
                      {states?.map((s) => (
                        <SelectItem key={s.id} value={s.name} className="capitalize hover:bg-white/5 focus:bg-white/5">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-zinc-500 text-[10px]">State for tax calculation.</FormDescription>
                  <FormMessage className="text-red-500 text-[10px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">Billing Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter your full address..." {...field} className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 min-h-[100px]" />
                  </FormControl>
                  <FormMessage className="text-red-500 text-[10px]" />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary text-[#010a05] font-bold tracking-wide uppercase hover:bg-primary/90 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Details
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
