'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Search, Plus, Trash2, UserCog } from 'lucide-react';
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
import { useUsersByRole, UserProfile, useUserProfile } from '@/services/user-service';
import { useUser, WithId } from '@/supabase';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createStaffUser, assignStaffRole, removeStaffRole } from './actions';
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


export default function StaffManagementPage() {
    const { user } = useUser();
    const { data: userProfile } = useUserProfile(user?.id);
    const { data: staffMembers, isLoading, error } = useUsersByRole('staff');
    const [searchTerm, setSearchTerm] = React.useState('');

    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [creationMode, setCreationMode] = React.useState<'new' | 'existing'>('new');
    const [staffToRemove, setStaffToRemove] = React.useState<WithId<UserProfile> | null>(null);
    const [showDuplicateUserDialog, setShowDuplicateUserDialog] = React.useState(false);
    const { toast } = useToast();

    const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', password: '' } });
    const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema), defaultValues: { email: '' } });

    const handleCreateFormSubmit = async (data: CreateFormValues) => {
        if (!user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine your user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await createStaffUser({ ...data, actor: { id: user.id, name: userProfile.name, role: 'admin' } });
            if (result.success) {
                toast({ title: 'Success', description: `Staff account for ${data.name} has been created.` });
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
        if (!user || !userProfile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not determine your user details.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await assignStaffRole({ email: data.email, actor: { id: user.id, name: userProfile.name, role: 'admin' } });
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

    const handleRemoveConfirm = async () => {
        if (!staffToRemove || !user || !userProfile) return;

        setIsSubmitting(true);
        try {
            const result = await removeStaffRole({ staffId: staffToRemove.id, actor: { id: user.id, name: userProfile.name, role: 'admin' } });
            if (result.success) {
                toast({ title: 'Staff Role Removed', description: `${staffToRemove.name} is no longer a staff member.` });
            } else {
                toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'An Unexpected Error Occurred', description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
            setStaffToRemove(null);
        }
    };

    const filteredStaff = React.useMemo(() => {
        if (!staffMembers) return [];
        return staffMembers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [staffMembers, searchTerm]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div className="absolute inset-0 bg-primary/10 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Syncing Staff Data...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center py-20 px-6 border border-red-500/20 bg-red-500/5 rounded-2xl">
                    <p className="text-red-400 font-bold mb-2">Error</p>
                    <p className="text-xs text-red-500/60 font-medium uppercase tracking-wider">{error.message}</p>
                </div>
            );
        }

        if (!staffMembers || staffMembers.length === 0) {
            return (
                <div className="py-32 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
                    <UserCog className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.4em]">No Active Staff</p>
                    <p className="text-zinc-400 text-[9px] mt-2 font-medium uppercase tracking-widest">Create a new staff account to manage the system.</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="relative group max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search name or email..."
                        className="pl-11 bg-white/10 border-white/10 text-white h-12 rounded-2xl placeholder:text-zinc-400 focus:border-primary/30 transition-all focus:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-xl">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14 px-6">Staff Member</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14">Email</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14">Phone Number</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14 px-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStaff.map((person: WithId<UserProfile>) => (
                                <TableRow key={person.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border border-white/10 group-hover:border-primary/30 transition-all">
                                                {person.photo_url && <AvatarImage src={person.photo_url} alt={person.name} />}
                                                <AvatarFallback className="bg-white/10 text-zinc-400 font-bold">{person.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{person.name}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-zinc-400 text-xs font-medium">{person.email}</TableCell>
                                    <TableCell className="text-zinc-400 text-xs font-mono">{person.phone || '—'}</TableCell>
                                    <TableCell className="px-6 py-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setStaffToRemove(person)}
                                            className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-zinc-400 transition-all"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-10 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-4">
                    <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
                        <Link href="/dashboard/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>

                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                <UserCog className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-4xl font-headline font-bold text-white tracking-tighter">
                                Staff <span className="text-primary/80">Management</span>
                            </h1>
                        </div>
                        <p className="text-zinc-400 text-[11px] font-medium uppercase tracking-[0.2em] ml-1">
                            List of all authenticated staff members. Manage their access and permissions.
                        </p>
                    </div>
                </div>

                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={isLoading} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all">
                            <Plus className="mr-2 h-4 w-4" /> Add Staff Member
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg bg-black/90 border-white/10 backdrop-blur-2xl p-0 overflow-hidden">
                        <div className="p-8 border-b border-white/5 bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                            <DialogHeader>
                                <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Add <span className="text-primary/80">Staff</span></DialogTitle>
                                <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    Create a new staff account or link an existing user.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-8">
                                <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                                    <div className={cn(
                                        "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                                        creationMode === 'new' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                                    )} onClick={() => setCreationMode('new')}>
                                        <RadioGroupItem value="new" id="s-r1" className="sr-only" />
                                        <Label htmlFor="s-r1" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">New Staff User</Label>
                                        {creationMode === 'new' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                                    </div>
                                    <div className={cn(
                                        "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                                        creationMode === 'existing' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                                    )} onClick={() => setCreationMode('existing')}>
                                        <RadioGroupItem value="existing" id="s-r2" className="sr-only" />
                                        <Label htmlFor="s-r2" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">Existing User</Label>
                                        {creationMode === 'existing' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        <div className="bg-black/40 p-8">
                            {creationMode === 'new' ? (
                                <Form {...createForm}>
                                    <form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-6">
                                        <FormField control={createForm.control} name="name" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Staff Name</FormLabel>
                                                <FormControl><Input placeholder="John Doe" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={createForm.control} name="email" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email</FormLabel>
                                                <FormControl><Input type="email" placeholder="staff@aavija.com" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={createForm.control} name="password" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Account Password</FormLabel>
                                                <FormControl><Input type="password" placeholder="Min. 8 characters" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <div className="flex justify-end gap-4 pt-4">
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-[#010a05] font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Create Staff Member
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            ) : (
                                <Form {...assignForm}>
                                    <form onSubmit={assignForm.handleSubmit(handleAssignFormSubmit)} className="space-y-6">
                                        <FormField control={assignForm.control} name="email" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">User Email</FormLabel>
                                                <FormControl><Input type="email" placeholder="user@aavija.com" {...field} className="bg-[#010a05]/95 backdrop-blur-3xl border-white/10 text-white h-11 rounded-xl placeholder:text-zinc-400" /></FormControl>
                                                <FormDescription className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Assign staff permissions to an existing user account.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <div className="flex justify-end gap-4 pt-4">
                                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 shadow-lg hover:bg-primary/90 transition-all">
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Assign Staff Role
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="glass-card border-white/10 shadow-xl relative overflow-hidden bg-white/5">
                <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
                <CardContent className="relative z-10 p-6 sm:p-8">
                    {renderContent()}
                </CardContent>
            </Card>

            <AlertDialog open={!!staffToRemove} onOpenChange={(open) => { if (!open) { setStaffToRemove(null); } }}>
                <AlertDialogContent className="bg-[#010a05]/95 backdrop-blur-3xl border-white/10 shadow-2xl max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                             <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white">Remove <span className="text-red-500">Access?</span></AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            This will remove the staff role from <span className="text-white font-bold">{staffToRemove?.name}</span>.
                            The user will be demoted to standard visitor status and will no longer have access to admin functions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-8">
                        <AlertDialogCancel onClick={() => setStaffToRemove(null)} className="bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                             <AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-lg">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Remove Access
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent className="bg-[#010a05]/95 backdrop-blur-3xl border-white/10 shadow-2xl max-w-sm">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shadow-sm">
                                <UserCog className="h-5 w-5 text-amber-500" />
                            </div>
                             <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white">Account <span className="text-amber-500">Exists</span></AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            The email provided is already associated with an account in the system.
                            Please change the selection to <span className="text-white font-black uppercase tracking-widest text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/10">Existing User</span> instead of "New Staff User" to safely assign staff permissions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6">
                         <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)} className="bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:bg-amber-600 shadow-md">Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
