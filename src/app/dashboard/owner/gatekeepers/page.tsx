'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Search, Plus, Edit, Trash2, Shield } from 'lucide-react';
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
import { useUsersByRoleAndPremise, UserProfile, useUserProfile } from '@/services/user-service';
import { useUser, WithId, useDoc } from '@/supabase'; // Import
import { createClient } from '@/lib/supabase/client';
import { Premise } from '@/services/premise-service'; // Import
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createGatekeeper, assignGatekeeperRoleByEmail } from './actions';
import { useSearchParams } from 'next/navigation';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const createSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    email: z.string().email('Please enter a valid email.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
});
type CreateFormValues = z.infer<typeof createSchema>;

const assignSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
});
type AssignFormValues = z.infer<typeof assignSchema>;


export default function GatekeepersPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premiseId') ?? undefined;
    const docRef = React.useMemo(() => {
        if (!premiseId) return null;
        return { table: 'premises', id: premiseId, __memo: true };
    }, [premiseId]);

    const { data: premise, isLoading: isPremiseLoading, error } = useDoc<Premise>(docRef);

    const { data: gatekeepers, isLoading: isLoadingGatekeepers, error: gatekeepersError } = useUsersByRoleAndPremise('gatekeeper', premiseId);
    const [searchTerm, setSearchTerm] = React.useState('');

    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);
    const { toast } = useToast();

    const isLoading = isLoadingGatekeepers || isPremiseLoading;

    const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '' } });
    const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema), defaultValues: { email: '' } });

    const handleCreateFormSubmit = async (data: CreateFormValues) => {
        if (!premiseId || !premise?.city || !user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine your premise or user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await createGatekeeper({ ...data, premiseId, premiseCity: premise.city, actor: { id: user.id, name: userProfile.name, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Gatekeeper account for ${data.name} has been created.` });
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
            const result = await assignGatekeeperRoleByEmail({ email: data.email, premiseId, actor: { id: user.id, name: userProfile.name, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Role assigned to ${data.email}.` });
                setIsFormOpen(false);
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

    const filteredGatekeepers = React.useMemo(() => {
        if (!gatekeepers) return [];
        return gatekeepers.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [gatekeepers, searchTerm]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        if (error) return (
            <div className="py-20 text-center text-red-500 border border-red-500/20 rounded-3xl bg-red-500/5">
                <Shield className="mx-auto h-10 w-10 mb-4 opacity-50" />
                <p className="font-bold uppercase tracking-widest text-[11px]">Sentinel Link Failure</p>
                <p className="text-[10px] opacity-60 mt-1">{error.message}</p>
            </div>
        );
        if (!gatekeepers || gatekeepers.length === 0) return (
            <div className="py-20 text-center text-zinc-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                <Plus className="mx-auto h-10 w-10 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">Sentinel Log Clear</p>
                <p className="text-[10px] opacity-60 mt-1">Initialize gatekeeper records to secure the perimeter.</p>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="relative group/search">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
                    <Input
                        placeholder="Scan sentinel files by name or neural mail..."
                        className="pl-12 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30 transition-all font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="rounded-3xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-white/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 pl-8">Sentinel Identity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Neural Link</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6">Comm Channel</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-6 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredGatekeepers.map((gatekeeper: any) => (
                                <TableRow key={gatekeeper.id} className="border-white/5 hover:bg-white/[0.02] group/row transition-colors">
                                    <TableCell className="pl-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border border-white/10 group-hover/row:border-primary/30 transition-colors">
                                                {gatekeeper.photo_url && <AvatarImage src={gatekeeper.photo_url} alt={gatekeeper.name} />}
                                                <AvatarFallback className="bg-white/5 text-zinc-400 font-bold">{gatekeeper.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{gatekeeper.name}</span>
                                                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Sentinel Class V</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-[10px] font-medium text-zinc-400 group-hover/row:text-zinc-200 transition-colors">{gatekeeper.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-[11px] font-mono text-zinc-500 tracking-tight">{gatekeeper.phone || 'NO ANALOG'}</div>
                                    </TableCell>
                                    <TableCell className='text-right pr-8'>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" disabled className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-800 opacity-20">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" disabled className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-800 opacity-20">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {filteredGatekeepers.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="text-[11px] font-black text-zinc-800 uppercase tracking-[0.3em]">No sentinel artifact detected</p>
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

                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={isLoading} className="h-11 bg-primary text-white font-black uppercase tracking-widest text-[10px] px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] rounded-xl">
                            <Plus className="mr-2 h-4 w-4" /> Recruit Sentinel
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#020617]/95 border-white/10 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <DialogHeader className="space-y-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Shield className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Sentinel Recruitment</DialogTitle>
                                <DialogDescription className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                                    Establish new perimeter link or authorize existing operative
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <div className="py-6 space-y-6">
                            <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                                <div className={cn(
                                    "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                    creationMode === 'new' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                )} onClick={() => setCreationMode('new')}>
                                    <RadioGroupItem value="new" id="g-r1" className="border-zinc-700 text-primary" />
                                    <Label htmlFor="g-r1" className="text-[11px] font-black uppercase tracking-widest text-white cursor-pointer">Protocol: New</Label>
                                </div>
                                <div className={cn(
                                    "flex items-center space-x-3 p-4 rounded-2xl border transition-all cursor-pointer",
                                    creationMode === 'existing' ? "bg-primary/5 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
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
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity Name</FormLabel>
                                                <FormControl><Input placeholder="John Doe" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <FormField control={createForm.control} name="email" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Neural Mail</FormLabel>
                                                <FormControl><Input type="email" placeholder="gatekeeper@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
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
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Cancel</Button></DialogClose>
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
                                                <FormDescription className="text-[9px] text-zinc-600 font-medium text-center">Email of an existing verified network identity</FormDescription>
                                                <FormMessage className="text-[9px] uppercase font-bold" />
                                            </FormItem>
                                        )} />
                                        <DialogFooter className="pt-4">
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 uppercase tracking-widest text-[9px] font-black">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                                {isSubmitting ? <Loader2 className="mr-2 h-3.3 w-4 animate-spin" /> : 'Bind Sentinel'}
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
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-4xl font-headline font-bold text-white tracking-tight">Sentinel <span className="text-primary/80">Command</span></CardTitle>
                    </div>
                    <CardDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest max-w-2xl leading-relaxed">
                        A centralized register of tactical personnel authorized for perimeter gate oversight.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                            <Shield className="h-6 w-6 text-amber-500" />
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

