'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Plus, 
    Users, 
    Search, 
    ArrowLeft, 
    Loader2, 
    Trash2, 
    Power, 
    AlertTriangle, 
    FileUp, 
    Upload, 
    Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
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
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { useUserProfile } from '@/services/user-service';
import { useUser, useDoc } from '@/supabase';
import { Premise, StaffMember } from '@/services/premise-service';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    Input,
} from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createHost, toggleHostStatus, removeHostFromPremise, assignHostRoleByEmail, backfillHostAvailability } from './actions';
import { bulkEnrollHosts, BulkMemberData } from '@/services/bulk-member-service';
import { usePremiseMembers, usePremiseGates, PremiseMember } from '@/services/premise-service';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';


const createSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email('Please enter a valid email.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    identity: z.string().min(1, 'Identity is required.'),
});
type CreateFormValues = z.infer<typeof createSchema>;

const assignSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
    identity: z.string().min(1, 'Identity is required.'),
});
type AssignFormValues = z.infer<typeof assignSchema>;

export default function HostsPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId') ?? undefined;

    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(docRef);

    const [page, setPage] = React.useState(0);
    const pageSize = 50;
    const [searchTerm, setSearchTerm] = React.useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    
    const { data: hosts, isLoading: isLoadingHosts } = usePremiseMembers(premiseId || '', 'host', { 
        searchTerm: debouncedSearchTerm,
        page,
        pageSize
    });

    const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostToToggle, setHostToToggle] = React.useState<PremiseMember | null>(null);
    const [hostToRemove, setHostToRemove] = React.useState<PremiseMember | null>(null);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [isBulkImportOpen, setIsBulkImportOpen] = React.useState(false);
    const [bulkProgress, setBulkProgress] = React.useState<number | null>(null);
    const [isMigrating, setIsMigrating] = React.useState(false);
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);

    const { toast } = useToast();

    const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '', identity: '' } });
    const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema), defaultValues: { email: '', identity: '' } });



    const handleBackfill = async () => {
        if (!premiseId) return;
        setIsMigrating(true);
        const result = await backfillHostAvailability(premiseId);
        if (result.success) {
            toast({ title: "Update Complete", description: result.message });
        } else {
            toast({ variant: 'destructive', title: "Update Failed", description: result.error });
        }
        setIsMigrating(false);
    };

    const handleCreateFormSubmit = async (data: CreateFormValues) => {
        if (!premiseId || !premise?.city || !user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine your premise or user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await createHost({ ...data, premiseId, premiseCity: premise.city, actor: { id: user.id, name: userProfile.name, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Host account for ${data.name} has been created.` });
                setIsCreateFormOpen(false);
                createForm.reset();
            } else {
                if (result.error === 'USER_ALREADY_EXISTS') {
                    setShowDuplicateUserDialog(true);
                } else {
                    toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
                }
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignFormSubmit = async (data: AssignFormValues) => {
        if (!premiseId || !user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine premise or user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await assignHostRoleByEmail({ email: data.email, identity: data.identity, premiseId, actor: { id: user.id, name: userProfile.name, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Role assigned to ${data.email}.` });
                setIsCreateFormOpen(false);
                assignForm.reset();
            } else {
                toast({ variant: 'destructive', title: 'Assignment Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !premiseId || !userProfile) return;

        setBulkProgress(0);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim());
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                
                const data = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const obj: any = {};
                    headers.forEach((header, i) => {
                        obj[header] = values[i];
                    });
                    return obj;
                });

                // Batch processing simulation / implementation
                const total = data.length;
                let processed = 0;
                
                // Real implementation would call the service with 3 arguments
                const result = await bulkEnrollHosts(
                    premiseId,
                    data,
                    { id: userProfile.id, name: userProfile.name, role: 'owner' }
                );

                if (result.success) {
                    setBulkProgress(100);
                    toast({ title: 'Bulk Enrollment Complete', description: `Successfully processed ${result.count} hosts.` });
                    setIsBulkImportOpen(false);
                } else {
                    toast({ variant: 'destructive', title: 'Bulk Enrollment Failed', description: result.errors.join(', ') || 'Unknown error' });
                }
                setBulkProgress(null);
            };
            reader.readAsText(file);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error Reading File', description: 'Failed to parse CSV file.' });
            setBulkProgress(null);
        }
    };

    const handleToggleStatusConfirm = async () => {
        if (!hostToToggle || !userProfile || !premiseId) return;
        setIsSubmitting(true);
        try {
            const newStatus = !(hostToToggle.is_active ?? true);
            const result = await toggleHostStatus({
                hostId: hostToToggle.user_id,
                hostName: hostToToggle.user?.name || 'Unknown',
                newStatus: newStatus,
                actor: { id: userProfile.id, name: userProfile.name, role: 'owner' },
                premiseId: premiseId,
            });
            if (result.success) {
                toast({ title: 'Success', description: `Host ${hostToToggle.user?.name || 'Unknown'} has been ${newStatus ? 'activated' : 'deactivated'}.` });
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
            setHostToToggle(null);
        }
    };

    const handleRemoveConfirm = async () => {
        if (!hostToRemove || !userProfile || !premiseId) return;
        setIsSubmitting(true);
        try {
            const result = await removeHostFromPremise({ 
                hostId: hostToRemove.user_id, 
                hostName: hostToRemove.user?.name || 'Unknown', 
                premiseId: premiseId, 
                actor: { id: userProfile.id, name: userProfile.name, role: 'owner' } 
            });
            if (result.success) {
                toast({ title: 'Host Removed', description: `${hostToRemove.user?.name || 'Unknown'} has been removed from this premise.` });
            } else {
                toast({ variant: 'destructive', title: 'Removal Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
            setHostToRemove(null);
        }
    };

    const filteredHosts = hosts || [];

    const renderContent = () => {
        if (isPremiseLoading || isLoadingHosts) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        
        if (!hosts || hosts.length === 0) return (
            <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-white/5 rounded-2xl bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                <Users className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">No Hosts Found</p>
                <p className="text-[10px] opacity-60 mt-1">Add host records or use bulk import to populate the list.</p>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Host Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Unit / Flat No.</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHosts.map((host) => {
                                const isActive = host.is_active ?? true;
                                return (
                                    <TableRow key={host.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors">
                                                        {host.user?.photo_url && <AvatarImage src={host.user.photo_url} alt={host.user.name} />}
                                                        <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{host.user?.name?.charAt(0) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#010a05]", isActive ? "bg-emerald-500" : "bg-red-500")} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{host.user?.name || 'Unknown'}</span>
                                                    <span className="text-[10px] text-zinc-400 font-medium tracking-tight uppercase">{host.user?.email || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-[11px] font-black text-zinc-400 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 inline-block group-hover/row:border-white/10 transition-colors">
                                                {host.identity}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={isActive ? 'outline' : 'destructive'} className={cn(
                                                "text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1",
                                                isActive ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" : "bg-red-500/5 text-red-500 border-red-500/20"
                                            )}>
                                                {isActive ? 'Active' : 'Deactivated'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className='text-right pr-8'>
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" title={isActive ? 'Deactivate' : 'Activate'} onClick={() => setHostToToggle(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                                    <Power className={cn("h-4 w-4", isActive ? "text-red-500/50 group-hover/row:text-red-500" : "text-emerald-500/50 group-hover/row:text-emerald-500")} />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Remove" onClick={() => setHostToRemove(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        Showing page <span className="text-white">{page + 1}</span>
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={page === 0} 
                            onClick={() => setPage(p => p - 1)}
                            className="bg-white/5 border-white/5 text-zinc-400 h-8 rounded-lg uppercase text-[9px] font-black tracking-widest px-4 disabled:opacity-20"
                        >
                            Previous
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={!hosts || hosts.length < pageSize} 
                            onClick={() => setPage(p => p + 1)}
                            className="bg-white/5 border-white/5 text-zinc-400 h-8 rounded-lg uppercase text-[9px] font-black tracking-widest px-4 disabled:opacity-20"
                        >
                            Next
                        </Button>
                    </div>
                </div>

                {filteredHosts.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.3em]">No matching host found</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container py-10 max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
                <Button asChild variant="ghost" className="text-zinc-400 hover:text-primary hover:bg-white/5 group/back">
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                    </Link>
                </Button>

                <div className="flex items-center gap-3">
                    <div className="relative group/search hidden sm:block">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 group-focus-within/search:text-primary transition-colors" />
                        <Input
                            placeholder="SEARCH HOSTS..."
                            className="pl-11 h-11 w-64 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="outline"
                                className="h-11 border-white/5 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-white/10 text-zinc-400"
                            >
                                <FileUp className="h-4 w-4" />
                                Bulk Import
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl max-w-2xl">
                            <DialogHeader className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <FileUp className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Bulk Enroll Hosts</DialogTitle>
                                    <DialogDescription className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                                        Upload a CSV file to enroll multiple hosts at once
                                    </DialogDescription>
                                </div>
                            </DialogHeader>

                            <div className="py-6 space-y-6">
                                <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors">
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        id="csv-upload" 
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                    />
                                    <label htmlFor="csv-upload" className="cursor-pointer">
                                        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                                            <Upload className="h-8 w-8 text-zinc-500 group-hover:text-primary transition-colors" />
                                        </div>
                                        <p className="text-white font-bold text-[13px] tracking-tight">Click to upload CSV</p>
                                        <p className="text-zinc-400 text-[10px] uppercase font-medium mt-1">Maximum 5000 records at a time</p>
                                    </label>
                                </div>

                                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bulk Enrollment Status</p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                                            onClick={() => {
                                                const csvContent = "name,email,password,identity\nJohn Doe,john@example.com,password123,A-101\nJane Smith,jane@example.com,password123,B-202";
                                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'aavija-hosts-template.csv';
                                                a.click();
                                            }}
                                        >
                                            <FileUp className="mr-2 h-3.3 w-3.3" /> Download Sample CSV
                                        </Button>
                                    </div>
                                    <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Info className="h-3 w-3" />
                                        Required CSV Headers:
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        {['name', 'email', 'identity', 'password'].map(header => (
                                            <span key={header} className="bg-black/50 text-white text-[9px] font-mono px-2 py-1 rounded border border-white/10">
                                                {header}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {bulkProgress !== null && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                            <span className="text-zinc-400">Processing...</span>
                                            <span className="text-primary">{bulkProgress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${bulkProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="ghost" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] px-8 rounded-xl">
                                <Plus className="mr-2 h-4 w-4" /> Add Host
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <DialogHeader className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Add Host</DialogTitle>
                                <DialogDescription className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                                    Create a new host account for the premise.
                                </DialogDescription>
                                </div>
                            </DialogHeader>

                            <div className="py-6 space-y-6">
                                <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                                    <div className={cn(
                                        "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                        creationMode === 'new' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )} onClick={() => setCreationMode('new')}>
                                        <RadioGroupItem value="new" id="h-r1" className="border-zinc-700 text-primary" />
                                        <Label htmlFor="h-r1" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Create New</Label>
                                    </div>
                                    <div className={cn(
                                        "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                        creationMode === 'existing' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )} onClick={() => setCreationMode('existing')}>
                                        <RadioGroupItem value="existing" id="h-r2" className="border-zinc-700 text-primary" />
                                        <Label htmlFor="h-r2" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Link Existing</Label>
                                    </div>
                                </RadioGroup>

                                {creationMode === 'new' && (
                                    <Form {...createForm}>
                                        <form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={createForm.control} name="name" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Full Name</FormLabel>
                                                        <FormControl><Input placeholder="John Doe" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                        <FormMessage className="text-[9px] uppercase font-bold" />
                                                    </FormItem>
                                                )} />
                                                <FormField control={createForm.control} name="email" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email Address</FormLabel>
                                                        <FormControl><Input type="email" placeholder="host@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                        <FormMessage className="text-[9px] uppercase font-bold" />
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FormField control={createForm.control} name="identity" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Unit / Flat No.</FormLabel>
                                                    <FormControl><Input placeholder="e.g. A-101" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="password" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Password</FormLabel>
                                                    <FormControl><Input type="password" placeholder="Minimum 8 characters" {...field} className="bg-black/40 border-white/10 text-white h-11" /></FormControl>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                            <DialogFooter className="pt-4">
                                                <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Cancel</Button></DialogClose>
                                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                    {isSubmitting ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : 'Confirm Add'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </Form>
                                )}

                                {creationMode === 'existing' && (
                                    <Form {...assignForm}>
                                        <form onSubmit={assignForm.handleSubmit(handleAssignFormSubmit)} className="space-y-4">
                                            <FormField control={assignForm.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email Address</FormLabel>
                                                    <FormControl><Input type="email" placeholder="user@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormDescription className="text-[9px] text-zinc-400 font-medium">The email address of the existing user you want to add</FormDescription>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                            <FormField control={assignForm.control} name="identity" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Unit / Flat No.</FormLabel>
                                                    <FormControl><Input placeholder="e.g. A-101" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                            <DialogFooter className="pt-4">
                                                <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Cancel</Button></DialogClose>
                                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                    {isSubmitting ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : 'Link User'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </Form>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20" />
                <CardHeader className="relative z-10 border-b border-white/5 pb-8 bg-[#010a05]/40">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                        <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Host <span className="text-primary/60">Management</span></CardTitle>
                        <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-1">
                            Manage residents and their unit assignments.
                        </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    <div className="sm:hidden mb-6">
                        <div className="relative group/search-mobile">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within/search-mobile:text-primary transition-colors" />
                            <Input
                                placeholder="SEARCH HOSTS..."
                                className="pl-12 bg-white/5 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-600 focus:border-primary/30 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!hostToToggle} onOpenChange={(open) => { if (!open) { setHostToToggle(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Change Host Status?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            You are about to <span className="text-primary font-bold">{hostToToggle?.is_active ?? true ? 'deactivate' : 'activate'}</span> {hostToToggle?.user?.name || 'this host'}.
                            {hostToToggle?.is_active ?? true ? ' They will no longer be visible to visitors at the gate.' : ' They will reappear in the visitor selection list.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleStatusConfirm} disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!hostToRemove} onOpenChange={(open) => { if (!open) { setHostToRemove(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight text-red-500">Remove Host?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            This will remove <span className="text-white font-bold">{hostToRemove?.user?.name || 'this host'}</span> from your premise.
                            They will lose access to this premise but will still be able to use the app as a visitor.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                            <AlertTriangle className="h-6 w-6 text-amber-500" />
                        </div>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">User Already Exists</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-[13px]">
                            A user with this email address already exists in our system.
                            Please use the <strong className="text-primary uppercase tracking-widest text-[11px]">Link Existing</strong> option to add them to your premise.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)} className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 h-12 uppercase font-black tracking-widest text-[10px]">Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

