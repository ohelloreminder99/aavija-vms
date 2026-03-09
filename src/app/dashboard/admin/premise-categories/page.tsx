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
  Shapes,
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
import { usePremiseCategories, type PremiseCategory } from '@/services/premise-category-service';
import {
  createPremiseCategoryAction,
  updatePremiseCategoryAction,
  deletePremiseCategoryAction,
} from '@/services/premise-category-actions';
import { useFirestore, WithId, useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';

const categorySchema = z.object({
  name: z.string().min(3, 'Category name is required.'),
  type: z.enum(['industrial', 'residential'], { required_error: 'Type is required.' }),
  deduction_rate_visitor: z.coerce.number().min(0, "Cost must be non-negative."),
  deduction_rate_premise: z.coerce.number().min(0, "Cost must be non-negative."),
  pdf_export_cost: z.coerce.number().min(0, "Cost must be non-negative."),
  csv_export_cost: z.coerce.number().min(0, "Cost must be non-negative."),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function PremiseCategoriesPage() {
  const { data: categories, isLoading, error } = usePremiseCategories();
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [categoryToEdit, setCategoryToEdit] = React.useState<WithId<PremiseCategory> | null>(null);
  const [categoryToDelete, setCategoryToDelete] = React.useState<WithId<PremiseCategory> | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'industrial',
      deduction_rate_visitor: 0,
      deduction_rate_premise: 0,
      pdf_export_cost: 0,
      csv_export_cost: 0
    },
  });

  React.useEffect(() => {
    if (categoryToEdit) {
      form.reset({
        name: categoryToEdit.name || '',
        type: categoryToEdit.type || 'industrial',
        deduction_rate_visitor: categoryToEdit.deduction_rate_visitor ?? 0,
        deduction_rate_premise: categoryToEdit.deduction_rate_premise ?? 0,
        pdf_export_cost: categoryToEdit.pdf_export_cost ?? 0,
        csv_export_cost: categoryToEdit.csv_export_cost ?? 0,
      });
    } else {
      form.reset({
        name: '',
        type: 'industrial',
        deduction_rate_visitor: 0,
        deduction_rate_premise: 0,
        pdf_export_cost: 0,
        csv_export_cost: 0
      });
    }
  }, [categoryToEdit, form]);

  const handleFormSubmit = async (data: CategoryFormValues) => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify current user.' });
      return;
    }

    try {
      const actor = { id: userProfile.id, name: userProfile.name, role: userProfile.role };
      if (categoryToEdit) {
        await updatePremiseCategoryAction(categoryToEdit.id, data, actor);
        toast({ title: 'Success', description: 'Category has been updated.' });
      } else {
        await createPremiseCategoryAction(data, actor);
        toast({ title: 'Success', description: 'New category has been created.' });
      }
      setIsFormOpen(false);
      setCategoryToEdit(null);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e.message || 'Something went wrong. Please try again.',
      });
    }
  };

  const handleDelete = async () => {
    if (categoryToDelete && userProfile) {
      try {
        await deletePremiseCategoryAction(categoryToDelete.id, { id: userProfile.id, name: userProfile.name, role: userProfile.role });
        toast({ title: 'Success', description: `Category "${categoryToDelete.name}" has been deleted.` });
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Deletion failed', description: e.message });
      } finally {
        setIsAlertOpen(false);
        setCategoryToDelete(null);
      }
    }
  };

  const openCreateForm = () => {
    setCategoryToEdit(null);
    form.reset();
    setIsFormOpen(true);
  };

  const openEditForm = (category: WithId<PremiseCategory>) => {
    setCategoryToEdit(category);
    setIsFormOpen(true);
  };

  const openDeleteDialog = (category: WithId<PremiseCategory>) => {
    setCategoryToDelete(category);
    setIsAlertOpen(true);
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

    if (!categories || categories.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Shapes className="mx-auto h-12 w-12" />
          <p className="mt-4 mb-2">No premise categories found.</p>
          <p className="text-sm">Click "Create Category" to get started.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Visitor Cost</TableHead>
            <TableHead>Premise Cost</TableHead>
            <TableHead>PDF Export Cost</TableHead>
            <TableHead>CSV Export Cost</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium capitalize">{category.name}</TableCell>
              <TableCell className="capitalize">{category.type}</TableCell>
              <TableCell>{category.deduction_rate_visitor}</TableCell>
              <TableCell>{category.deduction_rate_premise}</TableCell>
              <TableCell>{category.pdf_export_cost}</TableCell>
              <TableCell>{category.csv_export_cost}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => openEditForm(category)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(category)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild><Button onClick={openCreateForm}><Plus className="mr-2 h-4 w-4" />Create Category</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{categoryToEdit ? 'Edit Category' : 'Create Category'}</DialogTitle>
                <DialogDescription>{categoryToEdit ? 'Update the details of this category.' : 'Add a new premise category and define its costs.'}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Residential High-Traffic" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="industrial">Industrial</SelectItem>
                            <SelectItem value="residential">Residential</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deduction_rate_visitor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visitor Check-in Cost</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 5" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="deduction_rate_premise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Premise Check-in Cost</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 2" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pdf_export_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PDF Export Cost (for Premise)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 10" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="csv_export_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CSV Export Cost (for Premise)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 10" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {categoryToEdit ? 'Save Changes' : 'Create'}
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
          <CardTitle>Manage Premise Categories</CardTitle>
          <CardDescription>
            Define categories for your premises and set their specific token costs.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Deleting a category could affect premises that are currently assigned to it. Make sure no premises are using this category before deleting.</AlertDialogDescription>
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

