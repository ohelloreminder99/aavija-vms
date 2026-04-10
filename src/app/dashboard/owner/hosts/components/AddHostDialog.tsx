'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { createHost, assignHostRoleByEmail } from '../actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

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

interface AddHostDialogProps {
    premiseId?: string;
    premiseCity?: string;
    userId?: string;
    userName?: string;
}

export function AddHostDialog({ premiseId, premiseCity, userId, userName }: AddHostDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);

    const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '', identity: '' } });
    const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema), defaultValues: { email: '', identity: '' } });

    const handleCreateFormSubmit = async (data: CreateFormValues) => {
        if (!premiseId || !premiseCity || !userId || !userName) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine premise or user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await createHost({ ...data, premise_id: premiseId, premiseCity, actor: { id: userId, name: userName, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Host account for ${data.name} has been created.` });
                setIsOpen(false);
                createForm.reset();
                router.refresh();
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
        if (!premiseId || !userId || !userName) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine premise or user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await assignHostRoleByEmail({ email: data.email, identity: data.identity, premise_id: premiseId, actor: { id: userId, name: userName, role: 'owner' } });
            if (result.success) {
                toast({ title: 'Success', description: `Role assigned to ${data.email}.` });
                setIsOpen(false);
                assignForm.reset();
                router.refresh();
            } else {
                toast({ variant: 'destructive', title: 'Assignment Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
        </>
    );
}
