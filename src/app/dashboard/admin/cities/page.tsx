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
  useCities,
  createCity,
  updateCity,
  deleteCity,
  batchCreateCities,
  type City,
} from '@/services/city-service';
import { useStates } from '@/services/state-service';
import { useDistricts } from '@/services/district-service';
import { useFirestore, WithId } from '@/supabase';

const citySchema = z.object({
  name: z.string().min(1, 'City name is required.'),
  districtId: z.string().min(1, 'District is required.'),
});

type CityFormValues = z.infer<typeof citySchema>;

export default function CitiesPage() {
  const { data: cities, isLoading, error } = useCities();
  const { data: states } = useStates();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [cityToEdit, setCityToEdit] = React.useState<WithId<City> | null>(null);
  const [cityToDelete, setCityToDelete] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedStateId, setSelectedStateId] = React.useState<string>('');

  const { data: districts } = useDistricts(selectedStateId);

  const form = useForm<CityFormValues>({
    resolver: zodResolver(citySchema),
    defaultValues: { name: '', districtId: '' },
  });

  React.useEffect(() => {
    if (cityToEdit) {
      setSelectedStateId(cityToEdit.stateId);
      form.reset({
        name: cityToEdit.name,
        districtId: cityToEdit.districtId
      });
    } else {
      setSelectedStateId('');
      form.reset({ name: '', districtId: '' });
    }
  }, [cityToEdit, form]);

  const handleFormSubmit = async (data: CityFormValues) => {
    const selectedDistrict = districts?.find(d => d.id === data.districtId);
    if (!selectedDistrict) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected district is invalid.' });
      return;
    }
    const cityData = { ...data, districtName: selectedDistrict.name, stateId: selectedDistrict.stateId, stateName: selectedDistrict.stateName };

    try {
      if (cityToEdit) {
        await updateCity(firestore, cityToEdit.id, cityData);
        toast({ title: 'Success', description: 'City has been updated.' });
      } else {
        await createCity(firestore, cityData);
        toast({ title: 'Success', description: 'New city has been created.' });
      }
      setIsFormOpen(false);
      setCityToEdit(null);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  const handleDelete = () => {
    if (cityToDelete) {
      deleteCity(firestore, cityToDelete);
      toast({ title: 'Success', description: 'City has been deleted.' });
      setIsAlertOpen(false);
      setCityToDelete(null);
    }
  };

  const openCreateForm = () => {
    setCityToEdit(null);
    form.reset();
    setIsFormOpen(true);
  };

  const openEditForm = (city: WithId<City>) => {
    setCityToEdit(city);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setCityToDelete(id);
    setIsAlertOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const Papa = (await import('papaparse')).default;

    Papa.parse<{ name: string; districtName: string; stateName: string }>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const citiesToUpload = results.data.filter(
          (row) => row.name && row.districtName && row.stateName
        );

        if (citiesToUpload.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'No valid cities found in the CSV. Make sure it has "name", "districtName", and "stateName" headers.',
          });
          setIsUploading(false);
          return;
        }

        try {
          await batchCreateCities(firestore, citiesToUpload);
          toast({
            title: 'Upload Successful',
            description: `${citiesToUpload.length} cities have been added.`,
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

    if (!cities || cities.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Map className="mx-auto h-12 w-12" />
          <p className="mt-4 mb-2">No cities found.</p>
          <p className="text-sm">Click "Create City" or "Upload CSV" to get started.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>City</TableHead>
            <TableHead>District</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cities.map((city) => (
            <TableRow key={city.id}>
              <TableCell className="font-medium capitalize">{city.name}</TableCell>
              <TableCell className="capitalize">{city.districtName}</TableCell>
              <TableCell className="capitalize">{city.stateName}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEditForm(city)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(city.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <DialogTrigger asChild><Button onClick={openCreateForm}><Plus className="mr-2 h-4 w-4" />Create City</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{cityToEdit ? 'Edit City' : 'Create City'}</DialogTitle>
                <DialogDescription>{cityToEdit ? 'Update the details of this city.' : 'Add a new city to a district.'}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Pune" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={setSelectedStateId} value={selectedStateId}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a state" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {states?.map(s => <SelectItem key={s.id} value={s.id} className="capitalize">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="districtId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>District</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedStateId || !districts}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {districts?.map(d => <SelectItem key={d.id} value={d.id} className="capitalize">{d.name}</SelectItem>)}
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
                      {cityToEdit ? 'Save Changes' : 'Create'}
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
          <CardTitle>Manage Cities</CardTitle>
          <CardDescription>
            A list of all cities. For bulk uploads, use a CSV with &apos;name&apos;, &apos;districtName&apos;, and &apos;stateName&apos; headers. {' '}
            <a href="/sample-cities.csv" download className="text-primary underline">Download sample CSV</a>.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the city.</AlertDialogDescription>
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

