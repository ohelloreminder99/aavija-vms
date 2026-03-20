'use client';

/**
 * AAVIJA VMS — Apply for a New Premise
 * Route: /dashboard/[role]/apply (or any agent-accessible route)
 * 
 * Agent fills: Premise Name, Address, City, Owner Email (live ✓/✗ check).
 * Agent Email is pre-filled from session and is read-only.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, MapPin, Mail, CheckCircle2, XCircle, Loader2, Send, Search, User } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { checkOwnerEmail, submitPremiseApplication } from '@/services/premise-application-actions';

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

const FormSchema = z.object({
  premise_name: z.string().min(2, 'Premise name is required').max(120),
  premise_address: z.string().min(5, 'Address is required').max(300),
  city_id: z.string().uuid('Please select a city'),
  owner_email: z.string().email('Please enter a valid email'),
});

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface ApplyForPremiseFormProps {
  agentName: string;
  agentEmail: string;
  cities: { id: string; name: string; stateName: string }[];
  categories: { id: string; name: string }[];
  onSuccess?: (applicationId: string) => void;
}

export function ApplyForPremiseForm({
  agentName,
  agentEmail,
  cities,
  categories,
  onSuccess,
}: ApplyForPremiseFormProps) {
  const { toast } = useToast();
  const [citySearch, setCitySearch] = React.useState('');
  const [ownerCheckState, setOwnerCheckState] = React.useState<
    'idle' | 'checking' | 'valid' | 'invalid'
  >('idle');
  const [ownerName, setOwnerName] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const ownerDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredCities = React.useMemo(
    () =>
      cities.filter((c) =>
        `${c.name} ${c.stateName}`.toLowerCase().includes(citySearch.toLowerCase())
      ),
    [cities, citySearch]
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      premise_name: '',
      premise_address: '',
      city_id: '',
      owner_email: '',
    },
  });

  // ─── Live owner email check ───────────────────────────────────────────────

  const handleOwnerEmailChange = (email: string) => {
    form.setValue('owner_email', email);
    setOwnerCheckState('idle');
    setOwnerName(null);

    if (ownerDebounceRef.current) clearTimeout(ownerDebounceRef.current);
    if (!email || !email.includes('@')) return;

    setOwnerCheckState('checking');
    ownerDebounceRef.current = setTimeout(async () => {
      const result = await checkOwnerEmail(email);
      if (result.exists) {
        setOwnerCheckState('valid');
        setOwnerName(result.name || null);
      } else {
        setOwnerCheckState('invalid');
        setOwnerName(null);
      }
    }, 700);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    if (ownerCheckState !== 'valid') {
      toast({ title: 'Invalid Owner Email', description: 'Please enter an email that belongs to an existing Aavija user.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedCity = cities.find((c) => c.id === values.city_id);
      const result = await submitPremiseApplication({
        ...values,
        city_name: selectedCity?.name,
        city_state: selectedCity?.stateName,
      });

      if (!result.success) {
        toast({ title: 'Submission Failed', description: result.error, variant: 'destructive' });
        return;
      }

      setSubmitted(true);
      onSuccess?.(result.applicationId || '');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success Screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-12 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white tracking-tight">Application Submitted!</h3>
          <p className="text-zinc-400 text-sm mt-2 max-w-sm">
            Your premise application has been sent to the admin for review. You'll receive a WhatsApp notification once it's approved.
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-zinc-400 hover:text-white text-[10px] font-black uppercase tracking-widest"
          onClick={() => { form.reset(); setSubmitted(false); setOwnerCheckState('idle'); }}
        >
          Submit Another
        </Button>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* Premise Name */}
        <FormField
          control={form.control}
          name="premise_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Premise Name
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    {...field}
                    placeholder="e.g., Royal Society, Tech Park"
                    className="pl-10 bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-500"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address */}
        <FormField
          control={form.control}
          name="premise_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Premise Address
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    {...field}
                    placeholder="Full address of the property"
                    className="pl-10 bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-500"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* City */}
        <FormField
          control={form.control}
          name="city_id"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between mb-1">
                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  City
                </FormLabel>
                {field.value && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {cities.find((c) => c.id === field.value)?.name}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <Input
                    placeholder="Search city..."
                    className="pl-9 bg-black/40 border-white/5 text-white h-10 rounded-xl placeholder:text-zinc-500 text-sm"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-36 w-full rounded-xl border border-white/5 bg-black/40 p-2">
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-0.5">
                      {filteredCities.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            'flex items-center h-9 px-4 rounded-lg transition-all cursor-pointer',
                            field.value === c.id ? 'bg-primary/10 text-white' : 'hover:bg-white/5 text-zinc-400'
                          )}
                          onClick={() => field.onChange(c.id)}
                        >
                          <RadioGroupItem value={c.id} id={`city-${c.id}`} className="sr-only" />
                          <Label htmlFor={`city-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                            {c.name} <span className="opacity-40">{c.stateName}</span>
                          </Label>
                          {field.value === c.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </ScrollArea>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="h-px bg-white/5" />

        {/* Owner Email with live check */}
        <FormField
          control={form.control}
          name="owner_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Owner Email id <span className="opacity-50">(Person who manages the Premise)</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="email"
                    value={field.value}
                    onChange={(e) => handleOwnerEmailChange(e.target.value)}
                    placeholder="owner@email.com"
                    className={cn(
                      'pl-10 pr-10 bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-500 transition-all',
                      ownerCheckState === 'valid' && 'border-emerald-500/40 bg-emerald-500/5',
                      ownerCheckState === 'invalid' && 'border-red-500/40 bg-red-500/5'
                    )}
                  />
                  {/* Live status indicator */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {ownerCheckState === 'checking' && (
                      <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                    )}
                    {ownerCheckState === 'valid' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {ownerCheckState === 'invalid' && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
              </FormControl>
              {/* Owner name hint */}
              {ownerCheckState === 'valid' && ownerName && (
                <div className="flex items-center gap-1.5 mt-2">
                  <User className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    {ownerName}
                  </span>
                </div>
              )}
              {ownerCheckState === 'invalid' && (
                <p className="text-[10px] text-red-400 font-bold mt-2">
                  No account found. Ask the owner to sign up on Aavija first.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Agent Email (read-only) */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Your Agent Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
            <Input
              value={agentEmail}
              readOnly
              className="pl-10 bg-black/20 border-white/5 text-zinc-500 h-11 rounded-xl cursor-not-allowed"
            />
          </div>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
            Auto-filled from your profile. Cannot be changed.
          </p>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting || ownerCheckState === 'checking' || ownerCheckState === 'invalid' || ownerCheckState === 'idle'}
          className="w-full bg-primary text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all disabled:opacity-40"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Application...</>
          ) : (
            <><Send className="mr-2 h-4 w-4" /> Submit Application</>
          )}
        </Button>
      </form>
    </Form>
  );
}
