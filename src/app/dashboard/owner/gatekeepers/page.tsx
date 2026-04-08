'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    ArrowLeft, 
    Loader2, 
    Search, 
    Plus, 
    Edit, 
    Trash2, 
    Shield, 
    Power, 
    AlertTriangle,
    DoorOpen
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
} from "@/components/ui/select";
import { useUserProfile } from '@/services/user-service';
import { useUser, useDoc } from '@/supabase';
import { Premise, usePremiseMembers, usePremiseGates, PremiseMember } from '@/services/premise-service';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createGatekeeper, assignGatekeeperRoleByEmail, removeGatekeeperFromPremise, toggleGatekeeperStatus } from './actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

const createSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email('Please enter a valid email.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    gateId: z.string().optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

const assignSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
    gateId: z.string().optional(),
});
type AssignFormValues = z.infer<typeof assignSchema>;


export default function GatekeepersPage() {
    const router = useRouter();
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id');
    
    // Hooks using the new system
    const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(premiseId ? { table: 'premises', id: premiseId } : null);
    const { data: gates } = usePremiseGates(premiseId || '');
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [page, setPage] = React.useState(0);
    const pageSize = 50;
    
    const { data: gatekeepers, isLoading: isLoadingGatekeepers } = usePremiseMembers(premiseId || '', 'gatekeeper', { 
        searchTerm: debouncedSearchTerm,
        page,
        pageSize
    });
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);
    const [gatekeeperToRemove, setGatekeeperToRemove] = React.useState<PremiseMember | null>(null);
    const [gatekeeperToToggle, setGatekeeperToToggle] = React.useState<PremiseMember | null>(null);
    
    const { toast } = useToast();

    const isLoading = isLoadingGatekeepers || isPremiseLoading;

    const createForm = useForm<CreateFormValues>({ 
        resolver: zodResolver(createSchema), 
        defaultValues: { name: '', email: '', password: '', gateId: undefined } 
    });
    const assignForm = useForm<AssignFormValues>({ 
        resolver: zodResolver(assignSchema), 
        defaultValues: { email: '', gateId: undefined } 
    });

    const handleCreateFormSubmit = async (data: CreateFormValues) => {
        if (!premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const result = await createGatekeeper({ 
                ...data, 
                premiseId, 
                actor: { id: user.id, name: userProfile.name, role: 'owner' } 
            });
            if (result.success) {
                toast({ title: 'Success', description: `Gatekeeper account for ${data.name} has been created.` });
                router.refresh();
                setIsFormOpen(false);
                createForm.reset();
            } else {
                if (result.error === 'USER_ALREADY_EXISTS') {
                    setShowDuplicateUserDialog(true);
                } else {
                    toast({ variant: 'destructive', title: 'Creation Failed', description: result.error });
                }
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignFormSubmit = async (data: AssignFormValues) => {
        if (!premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const result = await assignGatekeeperRoleByEmail({ 
                email: data.email, 
                gateId: data.gateId,
                premiseId, 
                actor: { id: user.id, name: userProfile.name, role: 'owner' } 
            });
            if (result.success) {
                toast({ title: 'Success', description: `Role assigned to ${data.email}.` });
                router.refresh();
                setIsFormOpen(false);
                assignForm.reset();
            } else {
                toast({ variant: 'destructive', title: 'Assignment Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveConfirm = async () => {
        if (!gatekeeperToRemove || !premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const result = await removeGatekeeperFromPremise({
                premiseId,
                user_id: gatekeeperToRemove.user_id,
                actor: { id: user.id, name: userProfile.name, role: 'owner' }
            });
            if (result.success) {
                toast({ title: 'Success', description: `Gatekeeper ${gatekeeperToRemove.user?.name} removed from premise.` });
                router.refresh();
                setGatekeeperToRemove(null);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove sentinel.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatusConfirm = async () => {
        if (!gatekeeperToToggle || !premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const newStatus = !gatekeeperToToggle.is_active;
            const result = await toggleGatekeeperStatus({
                premiseId,
                user_id: gatekeeperToToggle.user_id,
                isActive: newStatus,
                actor: { id: user.id, name: userProfile.name, role: 'owner' }
            });
            if (result.success) {
                toast({ title: 'Status Updated', description: `Gatekeeper ${gatekeeperToToggle.user?.name} is now ${newStatus ? 'active' : 'inactive'}.` });
                router.refresh();
                setGatekeeperToToggle(null);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update sentinel status.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderContent = () => {
        if (isLoading && !gatekeepers) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        
        if (!gatekeepers || gatekeepers.length === 0) return (
            <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-white/5 rounded-2xl bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                <Shield className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">No Gatekeepers Registered</p>
                <p className="text-[10px] opacity-60 mt-1">Add gatekeeper records to manage premise security.</p>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Gatekeeper Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Assigned Gate</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {gatekeepers.map((gk) => (
                                <TableRow key={gk.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                                    <TableCell className="pl-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors">
                                                {gk.user?.photo_url && <AvatarImage src={gk.user.photo_url} alt={gk.user.name} />}
                                                <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{gk.user?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{gk.user?.name}</span>
                                                <span className="text-[10px] text-zinc-400 font-medium">{gk.user?.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <DoorOpen className="h-3 w-3 text-zinc-500" />
                                            <span className="text-[11px] font-mono text-zinc-300">
                                                {gates?.find(g => g.id === gk.gate_id)?.name || 'ALL GATES'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={gk.is_active ? 'default' : 'secondary'} className={cn(
                                            "uppercase text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full border",
                                            gk.is_active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                                        )}>
                                            {gk.is_active ? 'Active' : 'Offline'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className='text-right pr-8'>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => setGatekeeperToToggle(gk)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:text-primary transition-all">
                                                <Power className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setGatekeeperToRemove(gk)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-300 hover:text-red-500 transition-all">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
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
                            disabled={!gatekeepers || gatekeepers.length < pageSize} 
                            onClick={() => setPage(p => p + 1)}
                            className="bg-white/5 border-white/5 text-zinc-400 h-8 rounded-lg uppercase text-[9px] font-black tracking-widest px-4 disabled:opacity-20"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        )
    };

    if (!premiseId) return <div>Premise context lost.</div>;

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
                            placeholder="SEARCH GATEKEEPERS..."
                            className="pl-11 h-11 w-64 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-11 bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl hover:opacity-90 transition-all">
                                <Plus className="mr-2 h-4 w-4" /> Add Gatekeeper
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Add Gatekeeper</DialogTitle>
                                <DialogDescription className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                                    Create a new gatekeeper account or link an existing user
                                </DialogDescription>
                            </DialogHeader>

                            <div className="py-4 space-y-6">
                                <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                                    <div className={cn(
                                        "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                        creationMode === 'new' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5"
                                    )} onClick={() => setCreationMode('new')}>
                                        <RadioGroupItem value="new" id="g-r1" className="border-zinc-700 text-primary" />
                                        <Label htmlFor="g-r1" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Protocol: New</Label>
                                    </div>
                                    <div className={cn(
                                        "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                        creationMode === 'existing' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5"
                                    )} onClick={() => setCreationMode('existing')}>
                                        <RadioGroupItem value="existing" id="g-r2" className="border-zinc-700 text-primary" />
                                        <Label htmlFor="g-r2" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Protocol: Linked</Label>
                                    </div>
                                </RadioGroup>

                                {creationMode === 'new' && (
                                    <Form {...createForm}>
                                        <form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-4">
                                            <FormField control={createForm.control} name="name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Identity Name</FormLabel>
                                                    <FormControl><Input placeholder="John Doe" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="email" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Email Address</FormLabel>
                                                    <FormControl><Input type="email" placeholder="gatekeeper@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="gateId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Assigned Gate</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-black/40 border-white/5 text-white h-11">
                                                                <SelectValue placeholder="All Gates (Default)" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-[#010a05] border-white/10 text-white">
                                                            <SelectItem value="all">Unrestricted Access</SelectItem>
                                                            {gates?.map(gate => (
                                                                <SelectItem key={gate.id} value={gate.id}>{gate.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={createForm.control} name="password" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Password</FormLabel>
                                                    <FormControl><Input type="password" placeholder="8+ characters" {...field} className="bg-black/40 border-white/10 text-white h-11" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <DialogFooter className="pt-4">
                                                <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 text-[9px] font-black uppercase">Cancel</Button></DialogClose>
                                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[9px] h-11 px-8 shadow-lg shadow-primary/20">
                                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm Add'}
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
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">User Email</FormLabel>
                                                    <FormControl><Input type="email" placeholder="user@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <FormField control={assignForm.control} name="gateId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Assigned Gate</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-black/40 border-white/5 text-white h-11">
                                                                <SelectValue placeholder="All Gates (Default)" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-[#010a05] border-white/10 text-white">
                                                            <SelectItem value="all">Unrestricted Access</SelectItem>
                                                            {gates?.map(gate => (
                                                                <SelectItem key={gate.id} value={gate.id}>{gate.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                            <DialogFooter className="pt-4">
                                                <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 text-[9px] font-black uppercase">Cancel</Button></DialogClose>
                                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Link User'}
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
                <CardHeader className="relative z-10 border-b border-white/5 pb-8 bg-[#010a05]/40 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-2">
                        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Gatekeeper <span className="text-primary/60">Management</span></CardTitle>
                            <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] mt-1">
                                Manage security personnel and access points.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {renderContent()}
                </CardContent>
            </Card>

            {/* Removal Confirmation */}
            <AlertDialog open={!!gatekeeperToRemove} onOpenChange={(o) => { if (!o) setGatekeeperToRemove(null); }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-xl font-bold tracking-tight text-red-500 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5" />
                            Remove Gatekeeper?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            Are you sure you want to remove <span className="text-white font-bold">{gatekeeperToRemove?.user?.name}</span>? They will lose all access privileges immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400">Abort</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Remove Gatekeeper
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Status Toggle Confirmation */}
            <AlertDialog open={!!gatekeeperToToggle} onOpenChange={(o) => { if (!o) setGatekeeperToToggle(null); }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-xl font-bold tracking-tight flex items-center gap-3">
                            <Power className="h-5 w-5 text-primary" />
                            {gatekeeperToToggle?.is_active ? 'Deactivate Gatekeeper?' : 'Activate Gatekeeper?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            {gatekeeperToToggle?.is_active 
                                ? "Deactivate the security credentials for this gatekeeper temporarily?" 
                                : "Restore active status and access for this gatekeeper?"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleStatusConfirm} disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Protocol
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
