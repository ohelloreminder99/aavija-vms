'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Plus, 
    Search, 
    ArrowLeft, 
    Loader2, 
    Trash2, 
    Edit, 
    DoorOpen, 
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
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserProfile } from '@/services/user-service';
import { useUser, useDoc } from '@/supabase';
import { usePremiseGates, Premise, PremiseGate } from '@/services/premise-service';
import { createGate, updateGate, deleteGate } from './actions';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

const gateSchema = z.object({
    name: z.string().min(2, 'Name is required.'),
    description: z.string().optional(),
});
type GateFormValues = z.infer<typeof gateSchema>;

export default function GatesPage() {
    const router = useRouter();
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const searchParams = useSearchParams();
    const premiseId = searchParams.get('premise_id');
    
    const { data: premise, isLoading: isPremiseLoading } = useDoc<Premise>(premiseId ? { table: 'premises', id: premiseId } : null);
    const { data: gates, isLoading: isGatesLoading } = usePremiseGates(premiseId || '');
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [gateToEdit, setGateToEdit] = React.useState<PremiseGate | null>(null);
    const [gateToDelete, setGateToDelete] = React.useState<PremiseGate | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const form = useForm<GateFormValues>({
        resolver: zodResolver(gateSchema),
        defaultValues: { name: '', description: '' }
    });

    React.useEffect(() => {
        if (gateToEdit) {
            form.reset({
                name: gateToEdit.name,
                description: gateToEdit.description || ''
            });
        } else {
            form.reset({ name: '', description: '' });
        }
    }, [gateToEdit, form]);

    const onSubmit = async (values: GateFormValues) => {
        if (!premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const actor = { id: user.id, name: userProfile.name, role: 'owner' };
            let result;
            if (gateToEdit) {
                result = await updateGate({ 
                    gateId: gateToEdit.id, 
                    premise_id: premiseId!, 
                    name: values.name, 
                    description: values.description, 
                    actor 
                });
            } else {
                result = await createGate({ 
                    premise_id: premiseId!, 
                    name: values.name, 
                    description: values.description, 
                    actor 
                });
            }

            if (result.success) {
                toast({ title: 'Success', description: `Gate ${values.name} has been ${gateToEdit ? 'updated' : 'created'}.` });
                router.refresh();
                setIsCreateDialogOpen(false);
                setGateToEdit(null);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!gateToDelete || !premiseId || !user || !userProfile) return;
        setIsSubmitting(true);
        try {
            const result = await deleteGate({ 
                gateId: gateToDelete.id, 
                gateName: gateToDelete.name, 
                premise_id: premiseId!, 
                actor: { id: user.id, name: userProfile.name, role: 'owner' } 
            });
            if (result.success) {
                toast({ title: 'Success', description: `Gate ${gateToDelete.name} deleted.` });
                router.refresh();
                setGateToDelete(null);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredGates = React.useMemo(() => {
        if (!gates) return [];
        return gates.filter(g => g.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
    }, [gates, debouncedSearchTerm]);

    const renderContent = () => {
        if ((isGatesLoading || isPremiseLoading) && !gates) return <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
        
        if (!gates || gates.length === 0) return (
            <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-white/5 rounded-2xl bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                <DoorOpen className="mx-auto h-8 w-8 mb-3 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-[11px]">No Gates Found</p>
                <p className="text-[10px] opacity-60 mt-1">Add a gate entry point for this premise.</p>
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden shadow-2xl">
                    <Table>
                        <TableHeader className="bg-[#010a05]/95 backdrop-blur-3xl/[0.03]">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 pl-8">Gate Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4">Description</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-4 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredGates.map((gate) => (
                                <TableRow key={gate.id} className="border-white/5 hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] group/row transition-colors">
                                    <TableCell className="pl-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover/row:border-primary/40 transition-colors">
                                                <DoorOpen className="h-5 w-5 text-primary" />
                                            </div>
                                            <span className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{gate.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-[11px] text-zinc-400 font-medium">{gate.description || 'No description provided'}</div>
                                    </TableCell>
                                    <TableCell className='text-right pr-8'>
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => { setGateToEdit(gate); setIsCreateDialogOpen(true); }} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setGateToDelete(gate)} className="h-9 w-9 rounded-lg bg-white/5 border border-white/5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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

    if (!premiseId) return <div>Premise ID missing</div>;

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
                            placeholder="SEARCH GATES..."
                            className="pl-11 h-11 w-64 bg-white/5 border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-primary/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={(o) => { setIsCreateDialogOpen(o); if (!o) setGateToEdit(null); }}>
                        <DialogTrigger asChild>
                            <Button className="h-11 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 hover:opacity-90 transition-opacity whitespace-nowrap px-6">
                                <Plus className="h-4 w-4" />
                                Add Gate
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">{gateToEdit ? 'Edit Gate' : 'Add New Gate'}</DialogTitle>
                                <DialogDescription className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                                    Define entry points for your housing society or premise.
                                </DialogDescription>
                            </DialogHeader>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Gate Name</FormLabel>
                                            <FormControl><Input placeholder="e.g. Main Gate (North)" {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Description</FormLabel>
                                            <FormControl><Input placeholder="Optional gateway details..." {...field} className="bg-black/40 border-white/5 text-white h-11" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <DialogFooter className="pt-4">
                                        <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 text-[9px] font-black uppercase">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[9px] h-11 px-8">
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : gateToEdit ? 'Update Gate' : 'Create Gate'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="glass-card border-white/5 shadow-2xl relative overflow-hidden mb-20">
                <CardHeader className="relative z-10 border-b border-white/5 pb-6 bg-[#010a05]/40">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <DoorOpen className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-headline font-bold text-white tracking-tight">Gate <span className="text-primary/60">Management</span></CardTitle>
                    </div>
                    <CardDescription className="text-zinc-400 text-[10px] font-medium uppercase tracking-[0.2em] max-w-2xl leading-relaxed">
                        Control entry and exit points for the premise.
                    </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-8">
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!gateToDelete} onOpenChange={(o) => { if (!o) setGateToDelete(null); }}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white text-2xl font-bold tracking-tight text-red-500">Delete Gate?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            Are you sure you want to delete <span className="text-white font-bold">{gateToDelete?.name}</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-6">
                        <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Gate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
