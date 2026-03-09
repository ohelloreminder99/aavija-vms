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
      <div className="flex justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          GST & Billing Details
        </CardTitle>
        <CardDescription>
          Provide your legal business details for token purchase invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Farida Samnani" {...field} />
                  </FormControl>
                  <FormDescription>Official name to be printed on the Bill.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gstNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 27AAAAA0000A1Z5" {...field} className="uppercase" />
                  </FormControl>
                  <FormDescription>Leave blank if you don't have a GST number.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select registered state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {states?.map((s) => (
                        <SelectItem key={s.id} value={s.name} className="capitalize">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Used to calculate Place of Supply for GST split.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registered Billing Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Full address including district and pincode..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
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
