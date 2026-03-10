'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Search, Plus, Trash2, Power, AlertTriangle, Users } from 'lucide-react';
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
import { useUser, WithId, useDoc } from '@/supabase';
import { Premise, StaffMember } from '@/services/premise-service';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createHost, toggleHostStatus, removeHostFromPremise, assignHostRoleByEmail, backfillHostAvailability } from './actions';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
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

    const { data: premise, isLoading: isPremiseLoading, error } = useDoc<Premise>(docRef);

    const [searchTerm, setSearchTerm] = React.useState('');
    const [isCreateFormOpen, setIsCreateFormOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [hostToToggle, setHostToToggle] = React.useState<(StaffMember & { id: string }) | null>(null);
    const [hostToRemove, setHostToRemove] = React.useState<(StaffMember & { id: string }) | null>(null);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [isMigrating, setIsMigrating] = React.useState(false);
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);

    const { toast } = useToast();

    const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '', identity: '' } });
    const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema), defaultValues: { email: '', identity: '' } });

    const hosts = React.useMemo(() => {
        if (!premise || !premise.staff) return [];
        return premise.staff
            .filter(s => s.role === 'host')
            .map(s => ({ ...s, id: s.uid })); // Map uid to id for key prop and actions
    }, [premise]);

    const needsMigration = React.useMemo(() => {
        return hosts.some(host => typeof host.availability === 'undefined');
    }, [hosts]);

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

    const handleToggleStatusConfirm = async () => {
        if (!hostToToggle || !userProfile || !premiseId) return;
        setIsSubmitting(true);
        try {
            const newStatus = !(hostToToggle.is_active ?? true);
            const result = await toggleHostStatus({
                hostId: hostToToggle.id,
                hostName: hostToToggle.name,
                newStatus: newStatus,
                actor: { id: userProfile.id, name: userProfile.name, role: 'owner' },
                premiseId: premiseId,
            });
            if (result.success) {
                toast({ title: 'Success', description: `Host ${hostToToggle.name} has been ${newStatus ? 'activated' : 'deactivated'}.` });
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
            const result = await removeHostFromPremise({ hostId: hostToRemove.id, hostName: hostToRemove.name, premiseId: premiseId, actor: { id: userProfile.id, name: userProfile.name, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Host Removed', description: `${hostToRemove.name} has been removed from this premise.` });
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

    const filteredHosts = React.useMemo(() => {
        if (!hosts) return [];
        return hosts.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [hosts, searchTerm]);

    const renderContent = () => {
        if (isPremiseLoading) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        if (error) return (
            <div className="py-20 text-center text-red-500 border border-red-500/20 rounded-3xl bg-red-500/5">
                <AlertTriangle className="mx-auto h-10 w-10 mb-4 opacity-50" />
                <p className="font-bold uppercase tracking-widest text-[11px]">Neural Link Interrupted</p>
                <p className="text-[10px] opacity-60 mt-1">{error.message}</p>
            </div>
        );
        if (!hosts || hosts.length === 0) return (
            <div className="py-20 text-center text-zinc-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                <Plus className="mx-auto h-10 w-10 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">Directory Empty</p>
                <p className="text-[10px] opacity-60 mt-1">Initialize person-of-interest logs to begin.</p>
            </div>
        );
        return (
            <div className="space-y-6">
                <div className="relative group/search">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
                    <Input
                        placeholder="Scan directory by name or encrypted email..."
                        className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-white/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8">Host Identity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Linked Address</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-center">Neural Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredHosts.map((host) => {
                                const isActive = host.is_active ?? true;
                                return (
                                    <TableRow key={host.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                                        <TableCell className="pl-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors">
                                                        {host.photo_url && <AvatarImage src={host.photo_url} alt={host.name} />}
                                                        <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{host.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#020617]", isActive ? "bg-emerald-500" : "bg-red-500")} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{host.name}</span>
                                                    <span className="text-[10px] text-zinc-600 font-medium tracking-tight uppercase">{host.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-[11px] font-black text-zinc-500 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 inline-block group-hover/row:border-white/10 transition-colors">
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
                                                <Button variant="ghost" size="icon" title={isActive ? 'Sever Link' : 'Restore Link'} onClick={() => setHostToToggle(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                                                    <Power className={cn("h-4 w-4", isActive ? "text-red-500/50 group-hover/row:text-red-500" : "text-emerald-500/50 group-hover/row:text-emerald-500")} />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Purge Log" onClick={() => setHostToRemove(host)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all">
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
                {filteredHosts.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="text-[11px] font-black text-zinc-800 uppercase tracking-[0.3em]">No matching identity found in directory</p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="container py-10 max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
                <Button asChild variant="ghost" className="text-zinc-500 hover:text-primary hover:bg-white/5 group/back">
                    <Link href={`/dashboard/owner?premiseId=${premiseId}`} className="flex items-center">
                        <ArrowLeft className="mr-3 h-4 w-4 group-hover/back:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Back to Command Hub</span>
                    </Link>
                </Button>

                <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-11 bg-primary text-white font-black uppercase tracking-widest text-[10px] px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl">
                            <Plus className="mr-2 h-4 w-4" /> Recruit Host
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#020617]/95 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <DialogHeader className="space-y-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Plus className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Host Recruitment</DialogTitle>
                                <DialogDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                                    Initialize new nodal link or assign existing operative
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
                                    <Label htmlFor="h-r1" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Protocol: New</Label>
                                </div>
                                <div className={cn(
                                    "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                    creationMode === 'existing' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                )} onClick={() => setCreationMode('existing')}>
                                    <RadioGroupItem value="existing" id="h-r2" className="border-zinc-700 text-primary" />
                                    <Label htmlFor="h-r2" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Protocol: Linked</Label>
                                </div>
                            </RadioGroup>

                            {creationMode === 'new' && (
                                <Form {...createForm}>
                                    <form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity Name</FormLabel>
                                                    <FormControl><Input placeholder="John Doe" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Neural Mail</FormLabel>
                                                    <FormControl><Input type="email" placeholder="host@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage className="text-[9px] uppercase font-bold" />
                                                </FormItem>
                                            )} />
                                        </div>
                                        <FormField control={createForm.control} name="identity" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Node Specification</FormLabel>
                                                <FormControl><Input placeholder="e.g. Unit 402 - Sector B" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                <FormDescription className="text-[9px] text-zinc-600 font-medium">Physical coordinates for the host node</FormDescription>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <FormField control={createForm.control} name="password" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Initial Cipher</FormLabel>
                                                <FormControl><Input type="password" placeholder="8+ character secure string" {...field} className="bg-black/40 border-white/10 text-white h-11" /></FormControl>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <DialogFooter className="pt-4">
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Abort</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                {isSubmitting ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : 'Execute Sequence'}
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
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Operative Email</FormLabel>
                                                <FormControl><Input type="email" placeholder="user@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                <FormDescription className="text-[9px] text-zinc-600 font-medium">Email of an existing verified network identity</FormDescription>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <FormField control={assignForm.control} name="identity" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Node Specification</FormLabel>
                                                <FormControl><Input placeholder="e.g. Unit 402 - Sector B" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <DialogFooter className="pt-4">
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Abort</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                {isSubmitting ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : 'Bind Operative'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
                <CardHeader className="relative z-10 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Host <span className="text-primary/80">Directory</span></CardTitle>
                    </div>
                    <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
                        A centralized log of all verified entities with 'host' classification assigned to your premise node.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {needsMigration && (
                        <Alert className="mb-8 bg-amber-500/5 border-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-between p-6 overflow-hidden relative group/alert">
                            <div className="absolute inset-0 bg-amber-500 opacity-[0.02] group-hover/alert:opacity-[0.05] transition-opacity" />
                            <div className="flex items-start gap-4 relative z-10">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <AlertTitle className="text-[12px] font-black uppercase tracking-widest mb-1">Legacy Log Detected</AlertTitle>
                                    <AlertDescription className="text-[10px] font-medium text-zinc-400 max-w-lg leading-relaxed">
                                        Operative records require synchronization with the neural availability protocol. System default will be set to 'Available' for all logs.
                                    </AlertDescription>
                                </div>
                            </div>
                            <Button onClick={handleBackfill} disabled={isMigrating} size="sm" className="relative z-10 bg-amber-500 text-black font-black uppercase tracking-widest text-[9px] h-10 px-6 rounded-lg hover:bg-amber-400">
                                {isMigrating ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : "Sync Records"}
                            </Button>
                        </Alert>
                    )}
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!hostToToggle} onOpenChange={(open) => { if (!open) { setHostToToggle(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Modify Operative Access?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            You are about to <span className="text-primary font-bold">{hostToToggle?.is_active ?? true ? 'sever' : 'restore'}</span> the neural link for {hostToToggle?.name}.
                            {hostToToggle?.is_active ?? true ? ' They will no longer be visible in the visitor selection mesh.' : ' Their signature will reappear in the visitor selection mesh.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleStatusConfirm} disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Execute Protocol
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!hostToRemove} onOpenChange={(open) => { if (!open) { setHostToRemove(null); } }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight text-red-500">Purge Host Log?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            This will permanently remove <span className="text-white font-bold">{hostToRemove?.name}</span> from your premise directory.
                            Their account will be downgraded to 'Visitor' classification. They will retain network access but lose nodal association.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Purge Records
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
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight">Signature Collision Detected</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-[13px]">
                            A verified identity with this neural mail is already registered in the Aavija mesh.
                            Access the <strong className="text-primary uppercase tracking-widest text-[11px]">Bind Protocol</strong> (Assign Existing User) instead of the 'Protocol: New' sequence to link them to your node safely.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)} className="bg-white/5 text-white border border-white/10 hover:bg-white/10 px-8 h-12 uppercase font-black tracking-widest text-[10px]">Acknowledge</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

