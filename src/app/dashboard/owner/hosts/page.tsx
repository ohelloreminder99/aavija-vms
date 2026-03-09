'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Loader2, Search, Plus, Trash2, Power, AlertTriangle } from 'lucide-react';
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
        if (isPremiseLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        if (error) return <div className="text-center text-red-500 py-10"><p>An error occurred while fetching premise data.</p><p className="text-sm">{error.message}</p></div>;
        if (!hosts || hosts.length === 0) return <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg"><p>No hosts found.</p><p className='text-sm mt-1'>Click "Add Host" to create one.</p></div>;
        return (
            <>
                <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by name or email..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Identity</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className='text-right'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHosts.map((host) => {
                            const isActive = host.is_active ?? true;
                            return (
                                <TableRow key={host.id}>
                                    <TableCell className="font-medium"><div className="flex items-center gap-3"><Avatar>{host.photo_url && <AvatarImage src={host.photo_url} alt={host.name} />}<AvatarFallback>{host.name.charAt(0)}</AvatarFallback></Avatar><span>{host.name}</span></div></TableCell>
                                    <TableCell>{host.identity}</TableCell>
                                    <TableCell>{host.email}</TableCell>
                                    <TableCell><Badge variant={isActive ? 'secondary' : 'destructive'}>{isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                                    <TableCell className='text-right'>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" title={isActive ? 'Deactivate' : 'Activate'} onClick={() => setHostToToggle(host)}>
                                                <Power className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" title="Remove Host" onClick={() => setHostToRemove(host)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                {filteredHosts.length === 0 && <p className="py-10 text-center text-muted-foreground">No hosts match your search.</p>}
            </>
        )
    }

    return (
        <div className="container py-10">
            <div className="mb-4 flex items-center justify-between">
                <Button asChild variant="outline"><Link href={`/dashboard/owner?premiseId=${premiseId}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link></Button>
                <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
                    <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Host</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add Host</DialogTitle><DialogDescription>Create a new user account for a host or assign the role to an existing user.</DialogDescription></DialogHeader>
                        <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="flex items-center space-x-4"><div className="flex items-center space-x-2"><RadioGroupItem value="new" id="h-r1" /><Label htmlFor="h-r1">Create New User</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="existing" id="h-r2" /><Label htmlFor="h-r2">Assign Existing User</Label></div></RadioGroup>
                        {creationMode === 'new' && (
                            <Form {...createForm}><form onSubmit={createForm.handleSubmit(handleCreateFormSubmit)} className="space-y-4 py-4">
                                <FormField control={createForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="host@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={createForm.control} name="identity" render={({ field }) => (<FormItem><FormLabel>Host Identity</FormLabel><FormDescription>e.g., Flat A-101, or Purchase Dept - Samir Taurani</FormDescription><FormControl><Input placeholder="Identity" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={createForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" placeholder="Must be at least 8 characters" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Account</Button></DialogFooter>
                            </form></Form>
                        )}
                        {creationMode === 'existing' && (
                            <Form {...assignForm}>
                                <form onSubmit={assignForm.handleSubmit(handleAssignFormSubmit)} className="space-y-4 py-4">
                                    <FormField control={assignForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>User Email</FormLabel><FormDescription>Enter the email of the existing user you want to make a host.</FormDescription><FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={assignForm.control} name="identity" render={({ field }) => (<FormItem><FormLabel>Host Identity</FormLabel><FormDescription>e.g., Flat A-101, or Purchase Dept - Samir Taurani</FormDescription><FormControl><Input placeholder="Identity" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign Role</Button></DialogFooter>
                                </form>
                            </Form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Your Hosts</CardTitle>
                    <CardDescription>A list of all users with the &apos;host&apos; role at your premise.</CardDescription>
                </CardHeader>
                <CardContent>
                    {needsMigration && (
                        <Alert className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Update Host Records</AlertTitle>
                            <AlertDescription>
                                Some host records need to be updated with the new 'Availability' status. This will set their default status to 'Available'.
                                <Button onClick={handleBackfill} disabled={isMigrating} size="sm" className="mt-2 ml-auto block">
                                    {isMigrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Update Records
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {renderContent()}
                </CardContent>
            </Card>
            <AlertDialog open={!!hostToToggle} onOpenChange={(open) => { if (!open) { setHostToToggle(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>{`This will ${hostToToggle?.is_active ?? true ? 'deactivate' : 'activate'} the account for ${hostToToggle?.name}.`}{hostToToggle?.is_active ?? true ? ' They will no longer be able to be selected by visitors.' : ' They will be able to be selected by visitors again.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setHostToToggle(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleToggleStatusConfirm} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog open={!!hostToRemove} onOpenChange={(open) => { if (!open) { setHostToRemove(null); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will remove <span className="font-bold">{hostToRemove?.name}</span> from your premise and convert their account to a 'visitor' role. They will no longer be associated with your premise but can still use the app.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setHostToRemove(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemoveConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Remove Host</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Account Already Exists</AlertDialogTitle>
                        <AlertDialogDescription>
                            A user with that email address is already registered inside the network.
                            Please close this creation form and select <strong className="text-foreground border-b border-dashed border-primary">"Assign Existing User"</strong> instead of "Create New User" to assign them safely to this premise!
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

