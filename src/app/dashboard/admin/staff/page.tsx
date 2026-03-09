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
        if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        if (error) return <div className="text-center text-red-500 py-10"><p>An error occurred.</p><p className="text-sm">{error.message}</p></div>;
        if (!staffMembers || staffMembers.length === 0) return <div className="py-10 text-center text-muted-foreground"><p>No staff members found.</p><p className='text-sm mt-1'>Click "Add Staff" to create one.</p></div>;

        return (
            <>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStaff.map((staff: WithId<UserProfile>) => (
                            <TableRow key={staff.id}>
                                <TableCell className="font-medium"><div className="flex items-center gap-3"><Avatar>{staff.photo_url && <AvatarImage src={staff.photo_url} alt={staff.name} />}<AvatarFallback>{staff.name.charAt(0)}</AvatarFallback></Avatar><span>{staff.name}</span></div></TableCell>
                                <TableCell>{staff.email}</TableCell>
                                <TableCell>{staff.phone || 'N/A'}</TableCell>
                                <TableCell className='text-right'><Button variant="ghost" size="icon" onClick={() => setStaffToRemove(staff)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {filteredStaff.length === 0 && <p className="py-10 text-center text-muted-foreground">No staff members match your search.</p>}
            </>
        )
    }

    return (
        <div className="container py-10">
            <div className="mb-4 flex items-center justify-between">
                <Button asChild variant="outline"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link></Button>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild><Button disabled={isLoading}><Plus className="mr-2 h-4 w-4" />Add Staff</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Staff</DialogTitle>
                            <DialogDescription>Create a new staff user or assign the role to an existing user.</DialogDescription>
                        </DialogHeader>
                        <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="flex items-center space-x-4"><div className="flex items-center space-x-2"><RadioGroupItem value="new" id="s-r1" /><Label htmlFor="s-r1">Create New User</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="existing" id="s-r2" /><Label htmlFor="s-r2">Assign Existing User</Label></div></RadioGroup>

                        {creationMode === 'new' && (
                            <Form {...createForm}>
                                <form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-4 py-4">
                                    <FormField control={createForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="staff@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={createForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Must be at least 8 characters" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Account</Button></DialogFooter>
                                </form>
                            </Form>
                        )}

                        {creationMode === 'existing' && (
                            <Form {...assignForm}>
                                <form onSubmit={assignForm.handleSubmit(handleAssignFormSubmit)} className="space-y-4 py-4">
                                    <FormField control={assignForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>User Email</FormLabel><FormDescription>Enter the email of the existing user you want to make a staff member.</FormDescription><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign Role</Button></DialogFooter>
                                </form>
                            </Form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
            <Card>
                <CardHeader><CardTitle>Manage Staff</CardTitle><CardDescription>A list of all users with the &apos;staff&apos; role.</CardDescription></CardHeader>
                <CardContent>{renderContent()}</CardContent>
            </Card>
            <AlertDialog open={!!staffToRemove} onOpenChange={(open) => { if (!open) { setStaffToRemove(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>{`This will remove the staff role from ${staffToRemove?.name}. They will be reverted to a standard visitor account.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setStaffToRemove(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Account Already Exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            A user with that email address is already registered inside the network.
                            Please close this creation form and select <strong className="text-foreground border-b border-dashed border-primary">"Assign Existing User"</strong> instead of "Create New User" to assign them safely!
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)}>Understood</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

