'use client';

/**
 * AAVIJA VMS — Admin Premises Page (Phase 2B Update)
 * Agent assignment now uses email lookup instead of a dropdown.
 * Admin types the agent's email → system verifies → shows preview → saves.
 */

import * as React from 'react';
import { ArrowLeft, Loader2, Plus, Edit, Trash2, Search, Users, CheckCircle2, UserCircle2, Building, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Premise } from '@/services/premise-service';
import Link from 'next/link';
import { useCollection } from '@/supabase/firestore/use-collection';
import { WithId, useUser } from '@/supabase';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createPremiseAndNewOwner, createPremiseForExistingUser, deletePremise, changePremiseOwner, getPremisesForAdmin, updatePremiseAdmin, type SerializablePremiseWithDetails } from './actions';
import { lookupUserByEmail, designateAgentByEmail } from '@/services/agent-service';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCities } from '@/services/city-service';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUserProfile } from '@/services/user-service';
import { usePremiseCategories } from '@/services/premise-category-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';
import { cn } from '@/lib/utils';

const PremiseHistoryDialog = React.lazy(() => import('./components/PremiseHistoryDialog'));

// ── Agent Email Lookup Component ──────────────────────────────────────────────
// A self-contained sub-component that handles the email → user verification flow.
type AgentLookupResult = { id: string; name: string; photo_url: string; is_agent: boolean } | null;

function AgentEmailLookup({
  value,
  onChange,
}: {
  value: string;
  onChange: (agentId: string) => void;
}) {
  const [email, setEmail] = React.useState('');
  const [lookupResult, setLookupResult] = React.useState<AgentLookupResult>(null);
  const [isLooking, setIsLooking] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  const handleVerify = async () => {
    if (!email.trim()) return;
    setIsLooking(true);
    setLookupError(null);
    setLookupResult(null);
    const result = await lookupUserByEmail(email);
    if (result.success && result.user) {
      setLookupResult(result.user);
      onChange(result.user.id);
    } else {
      setLookupError(result.error || 'User not found.');
      onChange('');
    }
    setIsLooking(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Scan via neural mail..."
          className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-800"
          value={email}
          onChange={e => { setEmail(e.target.value); setLookupResult(null); onChange(''); }}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleVerify())}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={isLooking || !email}
          className="h-11 border-white/5 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-6"
        >
          {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ping'}
        </Button>
      </div>
      {lookupError && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest ml-1">{lookupError}</p>}
      {lookupResult && (
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 animate-in fade-in slide-in-from-top-2">
          <Avatar className="h-10 w-10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <AvatarImage src={lookupResult.photo_url} />
            <AvatarFallback className="bg-emerald-500/10 text-emerald-400">{lookupResult.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-400 leading-none mb-1">{lookupResult.name}</p>
            <p className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest">
              {lookupResult.is_agent ? 'Designated Operative' : 'Candidate Identified'}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
        </div>
      )}
      {!lookupResult && !lookupError && (
        <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em] ml-1">Establish neural connection via registered mail.</p>
      )}
    </div>
  );
}

// agentId in form now stores the resolved user ID from the email lookup
const newOwnerFormSchema = z.object({
  premiseName: z.string().min(3, 'Premise name must be at least 3 characters.'),
  premiseAddress: z.string().min(5, 'Address is required.'),
  cityId: z.string().min(1, 'City is required.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  ownerName: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('Please enter a valid email.'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  agentId: z.string().optional(),
});
type NewOwnerFormValues = z.infer<typeof newOwnerFormSchema>;

const existingUserFormSchema = z.object({
  premiseName: z.string().min(3, 'Premise name must be at least 3 characters.'),
  premiseAddress: z.string().min(5, 'Address is required.'),
  cityId: z.string().min(1, 'City is required.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  ownerEmail: z.string().email('Please enter a valid email for the owner.'),
  agentId: z.string().optional(),
});
type ExistingUserFormValues = z.infer<typeof existingUserFormSchema>;

const editFormSchema = z.object({
  name: z.string().min(3, 'Premise name must be at least 3 characters.'),
  address: z.string().min(5, 'Address is required.'),
  cityId: z.string().min(1, 'City is required.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  agentId: z.string().optional(),
  is_active: z.boolean(),
});
type EditFormValues = z.infer<typeof editFormSchema>;

export default function PremisesPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: cities } = useCities();
  const { data: categories } = usePremiseCategories();
  const { toast } = useToast();

  const [premises, setPremises] = React.useState<SerializablePremiseWithDetails[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
  const [isChangeOwnerOpen, setIsChangeOwnerOpen] = React.useState(false);
  const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');

  const [selectedPremise, setSelectedPremise] = React.useState<SerializablePremiseWithDetails | null>(null);
  const [premiseToChangeOwner, setPremiseToChangeOwner] = React.useState<SerializablePremiseWithDetails | null>(null);
  const [newOwnerEmail, setNewOwnerEmail] = React.useState<string | null>(null);
  const [selectedPremiseForHistory, setSelectedPremiseForHistory] = React.useState<SerializablePremiseWithDetails | null>(null);

  const [citySearch, setCitySearch] = React.useState('');
  const [agentSearch, setAgentSearch] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  const newOwnerForm = useForm<NewOwnerFormValues>({
    resolver: zodResolver(newOwnerFormSchema),
    defaultValues: { premiseName: '', premiseAddress: '', cityId: '', categoryId: '', ownerName: '', ownerEmail: '', ownerPassword: '', agentId: '', },
  });

  const existingUserForm = useForm<ExistingUserFormValues>({
    resolver: zodResolver(existingUserFormSchema),
    defaultValues: { premiseName: '', premiseAddress: '', cityId: '', categoryId: '', ownerEmail: '', agentId: '' },
  });

  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editFormSchema), });

  const fetchPremises = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getPremisesForAdmin();
    if (result.success && result.data) {
      setPremises(result.data);
    } else {
      setError(result.error || 'Failed to load premises data.');
    }
    setIsLoading(false);
  }, []);

  // Realtime Pulse: Whenever the premises table broadcasts a mutation, this will update and trigger a refetch.
  const { data: realtimePulse } = useCollection({ table: 'premises', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  React.useEffect(() => {
    fetchPremises();
  }, [fetchPremises, pulseHash]);

  const hasLogged = React.useRef(false);
  React.useEffect(() => {
    if (userProfile && !hasLogged.current) {
      hasLogged.current = true;
      createLogEntry({
        actorId: userProfile.id,
        actorName: userProfile.name,
        actorRole: 'admin',
        action: LogAction.VIEW_ALL_PREMISES_ADMIN,
        description: `Admin "${userProfile.name}" viewed the all premises dashboard.`
      });
    }
  }, [userProfile]);

  React.useEffect(() => {
    if (selectedPremise && isEditOpen) {
      editForm.reset({
        name: selectedPremise.name,
        address: selectedPremise.address,
        cityId: (selectedPremise as any).cityId || '',
        categoryId: selectedPremise.category?.id ?? '',
        agentId: selectedPremise.agent?.id || '',
        is_active: selectedPremise.is_active,
      });
    }
  }, [selectedPremise, isEditOpen, editForm]);

  const filteredCities = React.useMemo(() => cities?.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase())) || [], [cities, citySearch]);

  const filteredPremises = React.useMemo(() => {
    if (!premises) return [];
    const lowercasedFilter = searchTerm.toLowerCase();

    return premises.filter((p) => {
      const ownerName = p.owner?.name.toLowerCase() || '';
      const agentName = p.agent?.name.toLowerCase() || '';
      const categoryName = p.category?.name.toLowerCase() || '';

      return (
        p.name.toLowerCase().includes(lowercasedFilter) ||
        p.address.toLowerCase().includes(lowercasedFilter) ||
        p.city.toLowerCase().includes(lowercasedFilter) ||
        ownerName.includes(lowercasedFilter) ||
        agentName.includes(lowercasedFilter) ||
        categoryName.includes(lowercasedFilter)
      );
    });
  }, [premises, searchTerm]);


  const handleCreateSubmit = async (data: NewOwnerFormValues | ExistingUserFormValues) => {
    setIsSubmitting(true);
    try {
      const selectedCategory = categories?.find(c => c.id === data.categoryId);
      const selectedCityObj = cities?.find(c => c.id === data.cityId);

      const payload: any = {
        ...data,
        premiseCity: selectedCityObj?.name || 'Unknown',
        categoryName: selectedCategory?.name || null,
        city_state: selectedCityObj?.stateName || 'Unknown',
        cityId: data.cityId,
      };

      const result = creationMode === 'new'
        ? await createPremiseAndNewOwner(payload)
        : await createPremiseForExistingUser(payload);

      if (result.success) {
        toast({ title: 'Success', description: 'Premise created.' });
        setIsCreateOpen(false);
        newOwnerForm.reset();
        existingUserForm.reset();
        fetchPremises();
      } else {
        if (result.error === 'USER_ALREADY_EXISTS') {
          setShowDuplicateUserDialog(true);
        } else {
          toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: EditFormValues) => {
    if (!selectedPremise) return;
    setIsSubmitting(true);
    try {
      const selectedCategory = categories?.find(c => c.id === data.categoryId);
      const selectedCityObj = cities?.find(c => c.id === data.cityId);

      const dataToUpdate: Partial<Premise> = {
        name: data.name,
        address: data.address,
        city: selectedCityObj?.name || 'Unknown',
        cityId: data.cityId,
        agent_id: data.agentId,
        categoryName: selectedCategory?.name || null,
        categoryId: data.categoryId,
        city_state: selectedCityObj?.stateName || 'Unknown',
        is_active: data.is_active,
      };

      const res = await updatePremiseAdmin(selectedPremise.id, dataToUpdate);
      if (!res.success) throw new Error(res.error);
      toast({ title: 'Success', description: 'Premise has been updated.' });
      setIsEditOpen(false);
      fetchPremises();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPremise || !selectedPremise.owner) return;
    setIsSubmitting(true);
    try {
      const result = await deletePremise(selectedPremise.id, selectedPremise.owner.id);
      if (result.success) {
        toast({ title: 'Success', description: 'Premise has been deleted.' });
        fetchPremises();
      } else {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: result.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: "Something went wrong during deletion." });
    } finally {
      setIsDeleteAlertOpen(false);
      setSelectedPremise(null);
      setIsSubmitting(false);
    }
  };

  const handleChangeOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!premiseToChangeOwner || !premiseToChangeOwner.owner || !userProfile || !newOwnerEmail) return;
    setIsSubmitting(true);
    try {
      const result = await changePremiseOwner({
        premiseId: premiseToChangeOwner.id,
        oldOwnerId: premiseToChangeOwner.owner.id,
        newOwnerEmail: newOwnerEmail,
        actor: { id: userProfile.id, name: userProfile.name, role: 'admin' }
      });
      if (result.success) {
        toast({ title: 'Success', description: 'Ownership transferred.' });
        fetchPremises();
        setIsChangeOwnerOpen(false);
        setNewOwnerEmail('');
        setPremiseToChangeOwner(null);
      } else {
        toast({ variant: 'destructive', title: 'Transfer Failed', description: result.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openHistoryDialog = (p: SerializablePremiseWithDetails) => {
    const fullPremiseObject = { ...p, owner_id: p.owner?.id || '', agent_id: p.agent?.id || '', categoryId: p.category?.id || '', categoryName: p.category?.name || '' };
    setSelectedPremiseForHistory(fullPremiseObject as any);
    setIsHistoryDialogOpen(true);
  };

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (error) return (
      <div className="py-20 text-center text-red-500 border border-red-500/20 rounded-3xl bg-red-500/5">
        <Shield className="mx-auto h-10 w-10 mb-4 opacity-50" />
        <p className="font-bold uppercase tracking-widest text-[11px]">Nodal Link Failure</p>
        <p className="text-[10px] opacity-60 mt-1">{error}</p>
      </div>
    );
    if (!premises || premises.length === 0) return (
      <div className="py-20 text-center text-zinc-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
        <Building className="mx-auto h-10 w-10 mb-4 opacity-20" />
        <p className="font-bold uppercase tracking-widest text-[11px]">Infrastructure Negative</p>
        <p className="text-[10px] opacity-60 mt-1">No active premises detected in the architectural grid.</p>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="relative group/search">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
          <Input
            placeholder="Scan infrastructure by name, architectural unit, or city..."
            className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
          <Table>
            <TableHeader className="bg-white/[0.03]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8">Infrastructural Node</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Unit Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">City Nodal</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Master Principal</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPremises.map((p) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                  <TableCell className="pl-8 py-5">
                    <Button variant="link" className="p-0 h-auto font-bold text-white tracking-tight hover:text-primary transition-colors flex items-center gap-3 no-underline group-hover/row:text-primary" onClick={() => openHistoryDialog(p)}>
                      <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover/row:border-primary/30 transition-all">
                        <Building className="h-4 w-4" />
                      </div>
                      {p.name}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.2em] bg-white/5 border-white/10 text-zinc-400">
                      {p.category?.name || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] font-medium text-zinc-500 uppercase tracking-tighter">{p.city}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 border-none",
                      p.is_active
                        ? "bg-emerald-500/10 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "bg-red-500/10 text-red-500"
                    )}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.owner ? (
                      <div className="flex items-center gap-3">
                        <Avatar className='h-7 w-7 border border-white/10'>
                          <AvatarImage src={p.owner.photo_url} />
                          <AvatarFallback className="text-[10px] bg-white/5">{p.owner.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className='text-[11px] font-bold text-zinc-300'>{p.owner.name}</span>
                          <span className='text-[9px] font-black text-zinc-700 uppercase tracking-widest'>Nodal Principal</span>
                        </div>
                      </div>
                    ) : (
                      <span className='text-[9px] font-black uppercase tracking-widest text-zinc-800'>Orphan Node</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-primary hover:bg-primary/5 transition-all" onClick={() => { setSelectedPremise(p); setIsEditOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/5 transition-all" title="Transfer Ownership" onClick={() => { setPremiseToChangeOwner(p); setIsChangeOwnerOpen(true); }}><Users className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/5 transition-all" onClick={() => { setSelectedPremise(p); setIsDeleteAlertOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const form: any = creationMode === 'new' ? newOwnerForm : existingUserForm;

  return (
    <div className="container py-10 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
          <Link href="/dashboard/admin" className="flex items-center">
            <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Intelligence Hub</span>
          </Link>
        </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-white font-black uppercase tracking-wider text-xs h-11 px-8 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all">
              <Plus className="mr-2 h-4 w-4" /> Establish New Node
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl bg-black/90 border-white/10 backdrop-blur-2xl p-0 overflow-hidden flex flex-col h-[90vh] max-h-[800px]">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Node <span className="text-primary/80">Initialization</span></DialogTitle>
                </div>
                <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  Establish a new infrastructural unit within the Aavija global mesh.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-8">
                <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                    creationMode === 'new' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/10"
                  )} onClick={() => setCreationMode('new')}>
                    <RadioGroupItem value="new" id="r1" className="sr-only" />
                    <Label htmlFor="r1" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">New Nodal Principal</Label>
                    {creationMode === 'new' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                  </div>
                  <div className={cn(
                    "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                    creationMode === 'existing' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/10"
                  )} onClick={() => setCreationMode('existing')}>
                    <RadioGroupItem value="existing" id="r2" className="sr-only" />
                    <Label htmlFor="r2" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">Linked Operative</Label>
                    {creationMode === 'existing' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Form key={creationMode} {...((creationMode === 'new' ? newOwnerForm : existingUserForm) as any)}>
              <form onSubmit={form.handleSubmit(handleCreateSubmit as any)} className="flex-1 flex flex-col min-h-0 bg-black/40">
                <ScrollArea className="flex-1">
                  <div className="space-y-8 p-8">
                    <div className="grid grid-cols-2 gap-6">
                      <FormField control={form.control} name="premiseName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Node Designation</FormLabel>
                          <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-800" placeholder="e.g., Sector 7 Hub" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="categoryId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Unit Classification</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                                <SelectValue placeholder="Classification..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-zinc-900 border-white/10 text-white">
                              {categories?.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-primary focus:text-white">{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="premiseAddress" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Geographic Coordinates</FormLabel>
                        <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-800" placeholder="Analog Address..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="cityId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nodal Hub (City)</FormLabel>
                        <div className="space-y-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-700" />
                            <Input placeholder="Scan urban grids..." className="pl-9 bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-800" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                          </div>
                          <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/40 p-2">
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                                {filteredCities.map(c => (
                                  <div key={c.id} className={cn(
                                    "flex items-center h-10 px-4 rounded-xl transition-all cursor-pointer group",
                                    field.value === c.id ? "bg-primary/10 text-white" : "hover:bg-white/5 text-zinc-500"
                                  )} onClick={() => field.onChange(c.id)}>
                                    <RadioGroupItem value={c.id} id={`c-${c.id}`} className="sr-only" />
                                    <Label htmlFor={`c-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">{c.name}, <span className="opacity-50">{c.stateName}</span></Label>
                                    {field.value === c.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                  </div>
                                ))}
                              </RadioGroup>
                            </FormControl>
                          </ScrollArea>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="h-px bg-white/5" />

                    {creationMode === 'new' ? (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <UserCircle2 className="h-4 w-4 text-zinc-500" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Principal Identity Protocol</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <FormField control={form.control} name="ownerName" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Identity Name</FormLabel>
                              <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="ownerEmail" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Neural Mail</FormLabel>
                              <FormControl><Input type="email" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="ownerPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Access Cipher</FormLabel>
                            <FormControl><Input type="password" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    ) : (
                      <FormField control={form.control} name="ownerEmail" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Linked Neural Mail</FormLabel>
                          <FormControl><Input type="email" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" placeholder="operative@aavija.mesh" /></FormControl>
                          <FormDescription className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider">Assign an existing operative to master this infrastructural node.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    <div className="h-px bg-white/5" />

                    <FormField control={form.control} name="agentId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Local Facilitator (Agent)</FormLabel>
                        <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </ScrollArea>
                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Abort</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                    Initialize Node
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
        <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Premise <span className="text-primary/80">Oversight</span></CardTitle>
          </div>
          <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
            Architectural directory of all active nodal points. Monitor unit health, principal assignments, and hub distribution across the global mesh.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">{renderContent()}</CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-xl bg-black/90 border-white/10 backdrop-blur-2xl p-0 overflow-hidden flex flex-col h-[90vh] max-h-[800px]">
          <div className="p-8 border-b border-white/5 bg-white/[0.02]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Edit className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Node <span className="text-primary/80">Modification</span></DialogTitle>
              </div>
              <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                Recalibrate structural parameters for node: <span className="text-white font-bold">{selectedPremise?.name}</span>
              </DialogDescription>
            </DialogHeader>
          </div>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="flex-1 flex flex-col min-h-0 bg-black/40">
              <ScrollArea className="flex-1">
                <div className="space-y-8 p-8">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Node Designation</FormLabel>
                        <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="categoryId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Unit Classification</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                              <SelectValue placeholder="Classification..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={editForm.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Geographic Coordinates</FormLabel>
                      <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="cityId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nodal Hub (City)</FormLabel>
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
                          <Input placeholder="Scan grids..." className="pl-10 bg-black/40 border-white/5 text-white h-11 rounded-xl" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/40 p-2">
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                              {filteredCities.map(c => (
                                <div key={c.id} className={cn(
                                  "flex items-center h-10 px-4 rounded-xl transition-all cursor-pointer",
                                  field.value === c.id ? "bg-primary/10 text-white" : "hover:bg-white/5 text-zinc-500"
                                )} onClick={() => field.onChange(c.id)}>
                                  <RadioGroupItem value={c.id} id={`e-c-${c.id}`} className="sr-only" />
                                  <Label htmlFor={`e-c-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">{c.name}</Label>
                                  {field.value === c.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </ScrollArea>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="h-px bg-white/5" />

                  <FormField control={editForm.control} name="agentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Local Facilitator (Agent)</FormLabel>
                      <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={editForm.control} name="is_active" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-6">
                      <div className="space-y-1">
                        <FormLabel className="text-sm font-bold text-white tracking-tight">Node Operational Status</FormLabel>
                        <FormDescription className="text-[10px] text-zinc-600 font-medium uppercase tracking-tight">Toggle to temporarily decouple this node from the active mesh.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </ScrollArea>
              <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Abort</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Commit Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white">Decommission <span className="text-red-500">Node?</span></AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              This will permanently purge node <span className="text-white font-bold">{selectedPremise?.name}</span> from the global infrastructure directory.
              Access for all associated principals and operatives will be irreversibly revoked.
              Past active check-ins and ledger entries will be archived but decoupled from the live mesh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-8">
            <AlertDialogCancel disabled={isSubmitting} className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Purge Node
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate User Collision Dialog */}
      <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white font-headline">Identity <span className="text-amber-500">Collision</span></AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              The neural mail provided is already associated with an identity inside the network registry.
              Please recalibrate the request: select <span className="text-white font-black uppercase tracking-widest text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10">Linked Operative</span> instead of "New Nodal Principal" to securely bind the existing identity to this node.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)} className="bg-amber-500 text-black font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:bg-amber-600">Recalibrate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Owner Dialog */}
      <Dialog open={isChangeOwnerOpen} onOpenChange={setIsChangeOwnerOpen}>
        <DialogContent className="sm:max-w-md bg-black/90 border-white/10 backdrop-blur-2xl p-8">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight">Ownership <span className="text-primary/80">Transfer</span></DialogTitle>
            </div>
            <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              Reassign archival principal control for node: <span className="text-white">{premiseToChangeOwner?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangeOwnerSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">New Principal Neural Mail</Label>
              <Input type="email" required value={newOwnerEmail || ''} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="principal@aavija.mesh" className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-800" />
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Abort</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Commit Transfer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isHistoryDialogOpen && (
        <React.Suspense fallback={<div />}><PremiseHistoryDialog premise={selectedPremiseForHistory as any} allUsers={null} open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen} /></React.Suspense>
      )}
    </div>
  );
}
