'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Landmark,
  UploadCloud,
} from 'lucide-react';
// Dynamic import for papaparse moved to handleFileUpload

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  useStates,
  createState,
  updateState,
  deleteState,
  batchCreateStates,
  type State,
} from '@/services/state-service';
import { useFirestore, WithId } from '@/supabase';

const stateSchema = z.object({
  name: z.string().min(1, 'State name is required.'),
});

type StateFormValues = z.infer<typeof stateSchema>;

export default function StatesPage() {
  const { data: states, isLoading, error } = useStates();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [stateToEdit, setStateToEdit] = React.useState<WithId<State> | null>(
    null
  );
  const [stateToDelete, setStateToDelete] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<StateFormValues>({
    resolver: zodResolver(stateSchema),
    defaultValues: { name: '' },
  });

  React.useEffect(() => {
    if (stateToEdit) {
      form.reset({ name: stateToEdit.name });
    } else {
      form.reset({ name: '' });
    }
  }, [stateToEdit, form]);

  const handleFormSubmit = async (data: StateFormValues) => {
    try {
      if (stateToEdit) {
        await updateState(firestore, stateToEdit.id, data);
        toast({ title: 'Success', description: 'State has been updated.' });
      } else {
        await createState(firestore, data);
        toast({ title: 'Success', description: 'New state has been created.' });
      }
      setIsFormOpen(false);
      setStateToEdit(null);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  const handleDelete = () => {
    if (stateToDelete) {
      deleteState(firestore, stateToDelete);
      toast({ title: 'Success', description: 'State has been deleted.' });
      setIsAlertOpen(false);
      setStateToDelete(null);
    }
  };

  const openCreateForm = () => {
    setStateToEdit(null);
    form.reset();
    setIsFormOpen(true);
  };

  const openEditForm = (state: WithId<State>) => {
    setStateToEdit(state);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setStateToDelete(id);
    setIsAlertOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const Papa = (await import('papaparse')).default;

    Papa.parse<{ name: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const statesToUpload = results.data.filter((row) => row.name);

        if (statesToUpload.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'No valid states found in the CSV. Make sure it has a "name" header.',
          });
          setIsUploading(false);
          return;
        }

        try {
          await batchCreateStates(firestore, statesToUpload);
          toast({
            title: 'Upload Successful',
            description: `${statesToUpload.length} states have been added.`,
          });
        } catch (e) {
          console.error(e);
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'An error occurred while saving the states.',
          });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error: any) => {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Parsing Error',
          description: 'Could not parse the CSV file.',
        });
        setIsUploading(false);
      },
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
      );
    }

    if (error) {
      return (<div className="text-center text-red-500 py-10"><p>An error occurred: {error.message}</p></div>);
    }

    if (!states || states.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Landmark className="mx-auto h-12 w-12" />
          <p className="mt-4 mb-2">No states found.</p>
          <p className="text-sm">Click "Create State" or "Upload CSV" to get started.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State Name</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {states.map((state) => (
            <TableRow key={state.id}>
              <TableCell className="font-medium capitalize">{state.name}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEditForm(state)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(state.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <Button asChild variant="outline"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link></Button>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".csv" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Upload CSV
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild><Button onClick={openCreateForm}><Plus className="mr-2 h-4 w-4" />Create State</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{stateToEdit ? 'Edit State' : 'Create State'}</DialogTitle>
                <DialogDescription>{stateToEdit ? 'Update the name of this state.' : 'Add a new state to the list.'}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State Name</FormLabel>
                        <FormControl><Input placeholder="e.g., California" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {stateToEdit ? 'Save Changes' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage States</CardTitle>
          <CardDescription>
            A list of all states. For bulk uploads, use a CSV with a &apos;name&apos; header. {' '}
            <a href="/sample-states.csv" download className="text-primary underline">Download sample CSV</a>.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the state and could affect associated districts and cities.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

