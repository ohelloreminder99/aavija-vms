'use client';

/**
 * AAVIJA VMS — Admin Premises Page (Phase 2B Update)
 * Agent assignment now uses email lookup instead of a dropdown.
 * Admin types the agent's email → system verifies → shows preview → saves.
 */

import * as React from 'react';
import { ArrowLeft, Loader2, Plus, Edit, Trash2, Search, Users, CheckCircle2, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const PremiseHistoryDialog = React.lazy(() => import('./components/PremiseHistoryDialog'));

// ── Agent Email Lookup Component ──────────────────────────────────────────────
// A self-contained sub-component that handles the email → user verification flow.
type AgentLookupResult = { id: string; name: string; photo_url: string; is_agent: boolean } | null;

function AgentEmailLookup({
  value,
  onChange,
}: {
  value: string; // the resolved agentId stored in the form
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
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="agent@example.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setLookupResult(null); onChange(''); }}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleVerify())}
        />
        <Button type="button" variant="outline" onClick={handleVerify} disabled={isLooking || !email}>
          {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </Button>
      </div>
      {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
      {lookupResult && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={lookupResult.photo_url} />
            <AvatarFallback>{lookupResult.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">{lookupResult.name}</p>
            <p className="text-xs text-muted-foreground">
              {lookupResult.is_agent ? '✓ Existing agent' : 'Will be designated as agent'}
            </p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        </div>
      )}
      {!lookupResult && !lookupError && (
        <p className="text-xs text-muted-foreground">Type agent's registered email and click Verify.</p>
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
    if (isLoading) return (<div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>);
    if (error) return (<div className="text-center text-red-500 py-10"><p>An error occurred.</p><p className="text-sm">{error}</p></div>);
    if (!premises || premises.length === 0) return (<div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg"><p>No premise found.</p></div>);
    return (
      <>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>City</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Agent</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredPremises.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium"><Button variant="link" className="p-0 h-auto" onClick={() => openHistoryDialog(p)}>{p.name}</Button></TableCell>
                <TableCell className="capitalize">{p.category?.name || 'N/A'}</TableCell>
                <TableCell className="capitalize">{p.city}</TableCell>
                <TableCell><Badge variant={p.is_active ? 'default' : 'destructive'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                <TableCell>{p.owner ? <div className="flex items-center gap-2"><Avatar className='h-6 w-6'><AvatarImage src={p.owner.photo_url} /><AvatarFallback>{p.owner.name.charAt(0)}</AvatarFallback></Avatar><span className='text-xs'>{p.owner.name}</span></div> : 'N/A'}</TableCell>
                <TableCell><span className='text-xs'>{p.agent?.name || 'N/A'}</span></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedPremise(p); setIsEditOpen(true); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setPremiseToChangeOwner(p); setIsChangeOwnerOpen(true); }}><Users className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedPremise(p); setIsDeleteAlertOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  const form: any = creationMode === 'new' ? newOwnerForm : existingUserForm;

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <Button asChild variant="outline"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create Premise</Button></DialogTrigger>
          <DialogContent className="sm:max-w-md flex flex-col h-[90vh] max-h-[750px]">
            <DialogHeader><DialogTitle>Create New Premise</DialogTitle></DialogHeader>
            <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="flex items-center space-x-4"><div className="flex items-center space-x-2"><RadioGroupItem value="new" id="r1" /><Label htmlFor="r1">New Owner</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="existing" id="r2" /><Label htmlFor="r2">Existing User</Label></div></RadioGroup>
            <Form key={creationMode} {...((creationMode === 'new' ? newOwnerForm : existingUserForm) as any)}><form onSubmit={form.handleSubmit(handleCreateSubmit as any)} className="flex-1 flex flex-col min-h-0"><ScrollArea className="flex-1 -mx-6"><div className="space-y-6 px-6 py-4">
              <FormField control={form.control} name="premiseName" render={({ field }) => (<FormItem><FormLabel>Premise Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="categoryId" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="premiseAddress" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="cityId" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><Input placeholder="Search..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} /><ScrollArea className="h-32 w-full rounded-md border mt-2"><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="p-4">{filteredCities.map(c => <div key={c.id} className="flex items-center space-x-2 mb-2"><RadioGroupItem value={c.id} id={`c-${c.id}`} /><Label htmlFor={`c-${c.id}`} className="font-normal capitalize">{c.name}, {c.stateName}</Label></div>)}</RadioGroup></FormControl></ScrollArea><FormMessage /></FormItem>)} />
              <Separator />
              {creationMode === 'new' ? (
                <>
                  <FormField control={form.control} name="ownerName" render={({ field }) => (<FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="ownerEmail" render={({ field }) => (<FormItem><FormLabel>Owner Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="ownerPassword" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              ) : (
                <FormField control={form.control} name="ownerEmail" render={({ field }) => (<FormItem><FormLabel>Existing Owner Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              )}
              <Separator />
              <FormField control={form.control} name="agentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent (Optional)</FormLabel>
                  <FormDescription>Enter the registered email of the agent to assign to this premise.</FormDescription>
                  <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )} />
            </div></ScrollArea><DialogFooter className="py-4 border-t"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>Create</Button></DialogFooter></form></Form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardHeader><CardTitle>Premises</CardTitle></CardHeader><CardContent>{renderContent()}</CardContent></Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md flex flex-col h-[90vh] max-h-[750px]">
          <DialogHeader><DialogTitle>Edit Premise</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 -mx-6">
                <div className="space-y-6 px-6 py-4">
                  <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={editForm.control} name="categoryId" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Category..." /></SelectTrigger></FormControl><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={editForm.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={editForm.control} name="cityId" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><Input placeholder="Search City..." value={citySearch} onChange={(e) => setCitySearch(e.target.value)} /><ScrollArea className="h-32 border rounded-md mt-2"><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="p-2">{filteredCities.map(c => <div key={c.id} className='flex items-center space-x-2 mb-1'><RadioGroupItem value={c.id} id={`e-c-${c.id}`} /><Label htmlFor={`e-c-${c.id}`} className="font-normal capitalize">{c.name}</Label></div>)}</RadioGroup></FormControl></ScrollArea><FormMessage /></FormItem>)} />
                  <FormField control={editForm.control} name="agentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent (Optional)</FormLabel>
                      <FormDescription>Type the agent's email to reassign. Leave unchanged to keep current agent.</FormDescription>
                      <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Active Status</FormLabel><FormDescription>Turn off to temporarily suspend this Premise.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                </div>
              </ScrollArea>
              <DialogFooter className="py-4 border-t"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>Save</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the premise and irreversibly revoke access for all associated users. Data like invoices and past active check-ins may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Force Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate User Collision Dialog */}
      <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              A user with that email address is already registered inside the network.
              Please close this creation form and select <strong className="text-foreground border-b border-dashed border-primary">"Existing User"</strong> instead of "New Owner" to assign them to this premise safely!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Owner Dialog */}
      <Dialog open={isChangeOwnerOpen} onOpenChange={setIsChangeOwnerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer Ownership</DialogTitle><DialogDescription>Enter the email address of the new owner to transfer control of this premise.</DialogDescription></DialogHeader>
          <form onSubmit={handleChangeOwnerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>New Owner Email Address</Label>
              <Input type="email" required value={newOwnerEmail || ''} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="newowner@example.com" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Transfer Ownership'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isHistoryDialogOpen && (
        <React.Suspense fallback={<div />}><PremiseHistoryDialog premise={selectedPremiseForHistory as any} allUsers={null} open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen} /></React.Suspense>
      )}
    </div>
  );
}

