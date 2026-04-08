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
  Map,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  useDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  batchCreateDistricts,
  type District,
} from '@/services/district-service';
import { useStates } from '@/services/state-service';
import { useFirestore, WithId } from '@/supabase';

const districtSchema = z.object({
  name: z.string().min(1, 'District name is required.'),
  state_id: z.string().min(1, 'State is required.'),
});

type DistrictFormValues = z.infer<typeof districtSchema>;

export default function DistrictsPage() {
  const { data: districts, isLoading, error } = useDistricts();
  const { data: states } = useStates();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [districtToEdit, setDistrictToEdit] =
    React.useState<WithId<District> | null>(null);
  const [districtToDelete, setDistrictToDelete] = React.useState<string | null>(
    null
  );
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<DistrictFormValues>({
    resolver: zodResolver(districtSchema),
    defaultValues: { name: '', state_id: '' },
  });

  React.useEffect(() => {
    if (districtToEdit) {
      form.reset({
        name: districtToEdit.name,
        state_id: districtToEdit.state_id,
      });
    } else {
      form.reset({ name: '', state_id: '' });
    }
  }, [districtToEdit, form]);

  const handleFormSubmit = async (data: DistrictFormValues) => {
    const selectedState = states?.find(s => s.id === data.state_id);
    if (!selectedState) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected state is invalid.' });
      return;
    }
    const districtData = { name: data.name, state_id: data.state_id, state_name: selectedState.name };

    try {
      if (districtToEdit) {
        await updateDistrict(firestore, districtToEdit.id, districtData);
        toast({ title: 'Success', description: 'District has been updated.' });
      } else {
        await createDistrict(firestore, districtData);
        toast({ title: 'Success', description: 'New district has been created.' });
      }
      setIsFormOpen(false);
      setDistrictToEdit(null);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  const handleDelete = () => {
    if (districtToDelete) {
      deleteDistrict(firestore, districtToDelete);
      toast({ title: 'Success', description: 'District has been deleted.' });
      setIsAlertOpen(false);
      setDistrictToDelete(null);
    }
  };

  const openCreateForm = () => {
    setDistrictToEdit(null);
    form.reset();
    setIsFormOpen(true);
  };

  const openEditForm = (district: WithId<District>) => {
    setDistrictToEdit(district);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDistrictToDelete(id);
    setIsAlertOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const Papa = (await import('papaparse')).default;

    Papa.parse<{ name: string; state_name: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const districtsToUpload = results.data.filter(
          (row) => row.name && row.state_name
        );

        if (districtsToUpload.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'No valid districts found in the CSV. Make sure it has "name" and "state_name" headers.',
          });
          setIsUploading(false);
          return;
        }

        try {
          await batchCreateDistricts(firestore, districtsToUpload);
          toast({
            title: 'Upload Successful',
            description: `${districtsToUpload.length} districts have been added.`,
          });
        } catch (e: any) {
          console.error(e);
          toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error: any) => {
        console.error(error);
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not parse the CSV file.' });
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

    if (!districts || districts.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Map className="mx-auto h-12 w-12" />
          <p className="mt-4 mb-2">No districts found.</p>
          <p className="text-sm">Click "Create District" or "Upload CSV" to get started.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>District</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {districts.map((district) => (
            <TableRow key={district.id}>
              <TableCell className="font-medium capitalize">{district.name}</TableCell>
              <TableCell className="capitalize">{district.state_name}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEditForm(district)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(district.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTrigger asChild><Button onClick={openCreateForm}><Plus className="mr-2 h-4 w-4" />Create District</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{districtToEdit ? 'Edit District' : 'Create District'}</DialogTitle>
                <DialogDescription>{districtToEdit ? 'Update the details of this district.' : 'Add a new district to a state.'}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Pune" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a state" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {states?.map(s => <SelectItem key={s.id} value={s.id} className="capitalize">{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {districtToEdit ? 'Save Changes' : 'Create'}
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
          <CardTitle>Manage Districts</CardTitle>
          <CardDescription>
            A list of all districts. For bulk uploads, use a CSV with &apos;name&apos; and &apos;stateName&apos; headers. {' '}
            <a href="/sample-districts.csv" download className="text-primary underline">Download sample CSV</a>.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the district.</AlertDialogDescription>
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

