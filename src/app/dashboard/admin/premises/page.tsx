'use client';

/**
 * AAVIJA VMS — Admin Premises Page (Phase 2B Update)
 * Agent assignment now uses email lookup instead of a dropdown.
 * Admin types the agent's email → system verifies → shows preview → saves.
 */

import * as React from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Search, Users, CheckCircle2, UserCircle2, Building, Shield, AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTableRows } from '@/components/shared/SkeletonLoaders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WithId, useUser } from '@/supabase';
import { usePremises, usePremiseApplications, type Premise } from '@/services/premise-service';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createPremiseAndNewOwner, createPremiseForExistingUser, deletePremise, changePremiseOwner, getPremisesForAdmin, updatePremiseAdmin, type SerializablePremiseWithDetails } from './actions';
import { getPremiseApplications, type PremiseApplication } from '@/services/premise-application-actions';
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
import { AgentEmailLookup } from './components/AgentEmailLookup';
import { PremiseDialogs } from './components/PremiseDialogs';
import { PremiseApplicationsPanel } from './components/PremiseApplicationsPanel';
import { ClipboardList } from 'lucide-react';

const PremiseHistoryDialog = React.lazy(() => import('./components/PremiseHistoryDialog'));



// agentId in form now stores the resolved user ID from the email lookup
const newOwnerFormSchema = z.object({
  premiseName: z.string().min(3, 'Premise name must be at least 3 characters.'),
  premiseAddress: z.string().min(5, 'Address is required.'),
  city_id: z.string().min(1, 'City is required.'),
  category_id: z.string().min(1, 'Please select a category.'),
  owner_name: z.string().min(2, 'Owner name is required.'),
  ownerEmail: z.string().email('Please enter a valid email.'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  agent_id: z.string().optional(),
});
type NewOwnerFormValues = z.infer<typeof newOwnerFormSchema>;

const existingUserFormSchema = z.object({
  premiseName: z.string().min(3, 'Premise name must be at least 3 characters.'),
  premiseAddress: z.string().min(5, 'Address is required.'),
  city_id: z.string().min(1, 'City is required.'),
  category_id: z.string().min(1, 'Please select a category.'),
  ownerEmail: z.string().email('Please enter a valid email for the owner.'),
  agent_id: z.string().optional(),
});
type ExistingUserFormValues = z.infer<typeof existingUserFormSchema>;

const editFormSchema = z.object({
  name: z.string().min(3, 'Premise name must be at least 3 characters.'),
  address: z.string().min(5, 'Address is required.'),
  city_id: z.string().min(1, 'City is required.'),
  category_id: z.string().min(1, 'Please select a category.'),
  agent_id: z.string().optional(),
  is_active: z.boolean(),
});
type EditFormValues = z.infer<typeof editFormSchema>;

export default function PremisesPage() {
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: cities } = useCities();
  const { data: categories } = usePremiseCategories();
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = React.useState(0);
  const PAGE_SIZE = 25;

  // Real-time hooks for both premises and applications
  const { data: premisesData, isLoading: isPremisesLoading, error: premisesError } = usePremises({ page: currentPage, pageSize: PAGE_SIZE });
  const { data: applicationsData, isLoading: isAppsLoading } = usePremiseApplications();

  const premises = (premisesData || []) as any[];
  const applications = applicationsData || [];
  const isLoading = isPremisesLoading || isAppsLoading;
  const error = premisesError ? premisesError.message : null;
  const totalPremises = 0; 

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
    defaultValues: { premiseName: '', premiseAddress: '', city_id: '', category_id: '', owner_name: '', ownerEmail: '', ownerPassword: '', agent_id: '', },
  });

  const existingUserForm = useForm<ExistingUserFormValues>({
    resolver: zodResolver(existingUserFormSchema),
    defaultValues: { premiseName: '', premiseAddress: '', city_id: '', category_id: '', ownerEmail: '', agent_id: '' },
  });

  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editFormSchema), });

  const fetchPremises = React.useCallback(async (page = 0) => {
    // Legacy refresh kept for manual triggers if needed, though hooks should handle it.
    // In this refactor, we rely on the hooks.
  }, []);

  const hasLogged = React.useRef(false);
  React.useEffect(() => {
    if (userProfile && !hasLogged.current) {
      hasLogged.current = true;
      createLogEntry({
        actor_id: userProfile.id,
        actor_name: userProfile.name,
        actor_role: 'admin',
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
        city_id: (selectedPremise as any).city_id || '',
        category_id: selectedPremise.category?.id ?? '',
        agent_id: selectedPremise.agent?.id || '',
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
      const selectedCategory = categories?.find(c => c.id === data.category_id);
      const selectedCityObj = cities?.find(c => c.id === data.city_id);

      const payload: any = {
        ...data,
        premiseCity: selectedCityObj?.name || 'Unknown',
        category_name: selectedCategory?.name || null,
        city_state: selectedCityObj?.state_name || 'Unknown',
        city_id: data.city_id,
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
      const selectedCategory = categories?.find(c => c.id === data.category_id);
      const selectedCityObj = cities?.find(c => c.id === data.city_id);

      const dataToUpdate: Partial<Premise> = {
        name: data.name,
        address: data.address,
        city: selectedCityObj?.name || 'Unknown',
        city_id: data.city_id,
        agent_id: data.agent_id,
        category_name: selectedCategory?.name || null,
        category_id: data.category_id,
        city_state: selectedCityObj?.state_name || 'Unknown',
        is_active: data.is_active,
      };

      // Pass the updated_at timestamp for optimistic locking
      // If another admin edited this premise since you opened the dialog,
      // the server will return conflict:true instead of silently overwriting.
      const expectedUpdatedAt = (selectedPremise as any).updated_at ?? undefined;

      const res = await updatePremiseAdmin(selectedPremise.id, dataToUpdate, expectedUpdatedAt);

      if (res.conflict) {
        toast({
          variant: 'destructive',
          title: '⚠️ Edit Conflict',
          description: 'This premise was modified by someone else while you were editing. Please close and reopen the dialog to see the latest values.',
        });
        return;
      }

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
        premise_id: premiseToChangeOwner.id,
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
    const fullPremiseObject = { ...p, owner_id: p.owner?.id || '', agent_id: p.agent?.id || '', category_id: p.category?.id || '', category_name: p.category?.name || '' };
    setSelectedPremiseForHistory(fullPremiseObject as any);
    setIsHistoryDialogOpen(true);
  };

  // User-friendly error message mapping
  const friendlyError = (raw: string | null) => {
    if (!raw) return 'Something went wrong. Please try again.';
    if (raw.includes('JWT') || raw.includes('auth')) return 'Your session has expired. Please refresh the page and log in again.';
    if (raw.includes('network') || raw.includes('fetch')) return 'Network error — check your connection and try again.';
    if (raw.includes('permission') || raw.includes('Unauthorized')) return 'You do not have permission to perform this action.';
    if (raw.includes('not found')) return 'The requested record could not be found. It may have been deleted.';
    if (raw.includes('duplicate') || raw.includes('already exists')) return 'A record with this information already exists.';
    if (raw.includes('timeout')) return 'The request timed out. Please try again.';
    return raw;
  };

  const renderContent = () => {
    if (isLoading) return (
      // Skeleton table — same structure as the real table
      <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-xl">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 pl-8">Property Name</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Type</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">City</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Owner</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Sales Agent</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 text-right pr-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonTableRows rows={6} cols={7} />
        </Table>
      </div>
    );

    if (error) return (
      <EmptyState
        icon={AlertTriangle}
        title="Failed to load properties"
        description={friendlyError(error)}
        actionLabel="Try Again"
        onAction={() => fetchPremises(currentPage)}
        className="border-red-500/10 bg-red-500/5"
      />
    );

    if (!premises || premises.length === 0) return (
      <EmptyState
        icon={Building}
        title="No Properties Found"
        description="No properties are registered in the system yet. Create the first one to get started."
        actionLabel="+ Add Property"
        onAction={() => setIsCreateOpen(true)}
      />
    );

    return (
      <div className="space-y-6">
        <div className="relative group/search">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 group-focus-within/search:text-primary transition-colors" />
          <Input
            placeholder="Search by property name, type, or city..."
            className="pl-12 bg-white/10 border-white/10 text-white h-12 rounded-2xl placeholder:text-zinc-400 focus:border-primary/30 transition-all font-medium"
            value={searchTerm}
            aria-label="Search properties"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* overflow-x-auto ensures table scrolls on mobile instead of breaking layout */}
        <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-xl overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 pl-8">Property Name</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">City</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Owner</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Sales Agent</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPremises.map((p) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                  <TableCell className="pl-8 py-5">
                    <Button variant="link" className="p-0 h-auto font-bold text-white tracking-tight hover:text-primary transition-colors flex items-center gap-3 no-underline group-hover/row:text-primary" onClick={() => openHistoryDialog(p)}>
                      <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center group-hover/row:border-primary/30 transition-all">
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
                  <TableCell className="text-[11px] font-medium text-zinc-400 uppercase tracking-tighter">{p.city}</TableCell>
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
                          <span className='text-[9px] font-black text-zinc-400 uppercase tracking-widest'>Owner</span>
                        </div>
                      </div>
                    ) : (
                      <span className='text-[9px] font-black uppercase tracking-widest text-zinc-300'>No Owner</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.agent ? (
                      <div className="flex flex-col gap-0.5">
                        <span className='text-[11px] font-bold text-zinc-300'>{p.agent.name}</span>
                        <span className='text-[9px] text-zinc-500 font-medium lowercase tracking-tight break-all max-w-[150px]'>{p.agent.email}</span>
                      </div>
                    ) : (
                      <span className='text-[9px] font-black uppercase tracking-widest text-zinc-600'>None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" aria-label="Edit premise" className="h-9 w-9 rounded-lg bg-white/10 border border-white/10 text-zinc-400 hover:text-primary hover:bg-primary/5 transition-all" onClick={() => { setSelectedPremise(p); setIsEditOpen(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Transfer ownership" className="h-9 w-9 rounded-lg bg-white/10 border border-white/10 text-zinc-400 hover:text-amber-500 hover:bg-amber-500/5 transition-all" title="Transfer Ownership" onClick={() => { setPremiseToChangeOwner(p); setIsChangeOwnerOpen(true); }}><Users className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete premise" className="h-9 w-9 rounded-lg bg-white/10 border border-white/10 text-zinc-400 hover:text-red-500 hover:bg-red-500/5 transition-all" onClick={() => { setSelectedPremise(p); setIsDeleteAlertOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPremises > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalPremises)} of {totalPremises} properties
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 0 || isLoading}
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-xl disabled:opacity-30"
              >
                ← Prev
              </Button>
              <span className="text-[10px] font-black text-zinc-400 bg-white/5 border border-white/10 rounded-lg px-4 py-2 min-w-[60px] text-center">
                {currentPage + 1} / {Math.ceil(totalPremises / PAGE_SIZE)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={(currentPage + 1) * PAGE_SIZE >= totalPremises || isLoading}
                onClick={() => setCurrentPage(p => p + 1)}
                className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-xl disabled:opacity-30"
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const form: any = creationMode === 'new' ? newOwnerForm : existingUserForm;

  return (
    <div className="container py-10 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
          <Link href="/dashboard/admin" className="flex items-center">
            <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Button>

          <PremiseDialogs
            isCreateOpen={isCreateOpen}
            setIsCreateOpen={setIsCreateOpen}
            creationMode={creationMode}
            setCreationMode={setCreationMode}
            newOwnerForm={newOwnerForm}
            existingUserForm={existingUserForm}
            handleCreateSubmit={handleCreateSubmit}
            isEditOpen={isEditOpen}
            setIsEditOpen={setIsEditOpen}
            editForm={editForm}
            handleEditSubmit={handleEditSubmit}
            selectedPremise={selectedPremise}
            isDeleteAlertOpen={isDeleteAlertOpen}
            setIsDeleteAlertOpen={setIsDeleteAlertOpen}
            handleDeleteConfirm={handleDeleteConfirm}
            isChangeOwnerOpen={isChangeOwnerOpen}
            setIsChangeOwnerOpen={setIsChangeOwnerOpen}
            premiseToChangeOwner={premiseToChangeOwner}
            newOwnerEmail={newOwnerEmail}
            setNewOwnerEmail={setNewOwnerEmail}
            handleChangeOwnerSubmit={handleChangeOwnerSubmit}
            showDuplicateUserDialog={showDuplicateUserDialog}
            setShowDuplicateUserDialog={setShowDuplicateUserDialog}
            isSubmitting={isSubmitting}
            categories={categories || []}
            cities={cities || []}
            filteredCities={filteredCities}
            citySearch={citySearch}
            setCitySearch={setCitySearch}
          />
        </div>
      </div>

      <Card className="glass-card border-white/10 shadow-xl relative overflow-hidden mb-20">
        <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Property <span className="text-primary/80">Management</span></CardTitle>
          </div>
          <CardDescription className="text-zinc-400 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
            Manage all properties in the system. View property details, owners, and assigned sales agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">{renderContent()}</CardContent>
      </Card>









      {isHistoryDialogOpen && (
        <React.Suspense fallback={<div />}><PremiseHistoryDialog premise={selectedPremiseForHistory as any} allUsers={null} open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen} /></React.Suspense>
      )}

      {/* Applications Section */}
      <Card className="glass-card border-white/10 shadow-xl relative overflow-hidden mt-8">
        <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
        <CardHeader className="relative z-10 border-b border-white/5 pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <ClipboardList className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">
                  Premise <span className="text-amber-400">Applications</span>
                </CardTitle>
                <CardDescription className="text-zinc-400 text-[11px] font-medium uppercase tracking-widest mt-1">
                  Applications submitted by agents — review and approve with one click.
                </CardDescription>
              </div>
            </div>
            {applications.filter(a => a.status === 'pending').length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                {applications.filter(a => a.status === 'pending').length} Pending
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pt-8">
          <PremiseApplicationsPanel
            applications={applications}
            onRefresh={fetchPremises}
          />
        </CardContent>
      </Card>
    </div>
  );
}
