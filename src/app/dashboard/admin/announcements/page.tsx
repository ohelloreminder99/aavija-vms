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
  Calendar,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  useAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
  type UserRole,
} from '@/services/announcement-service';
import { useStates } from '@/services/state-service';
import { useDistricts } from '@/services/district-service';
import { useCities } from '@/services/city-service';
import { useFirestore, useUser, WithId } from '@/supabase';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserProfile } from '@/services/user-service';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

const announcementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long.'),
  message: z.string().min(10, 'Message must be at least 10 characters long.'),
  targetRoles: z.array(z.string()).refine((value) => value.length > 0, {
    message: 'Select at least one role.',
  }),
  targetStates: z.array(z.string()).optional(),
  targetDistricts: z.array(z.string()).optional(),
  targetCities: z.array(z.string()).optional(),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

const availableRoles: { id: UserRole; label: string }[] = [
  { id: 'owner', label: 'Owners' },
  { id: 'visitor', label: 'Visitors' },
  { id: 'host', label: 'Hosts' },
  { id: 'gatekeeper', label: 'Gatekeepers' },
  { id: 'staff', label: 'Staff' },
];

export default function AnnouncementsPage() {
  const { data: announcements, isLoading, error } = useAnnouncements();
  const { data: states } = useStates();
  const { data: allDistricts } = useDistricts();
  const { data: allCities } = useCities();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();
  const { data: userProfile } = useUserProfile(user?.id);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [announcementToEdit, setAnnouncementToEdit] = React.useState<WithId<Announcement> | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = React.useState<string | null>(null);

  // Local state for BROWSE FILTERS (Not for targeting)
  const [browseStateId, setBrowseStateId] = React.useState<string>('');
  const [browseDistrictId, setBrowseDistrictId] = React.useState<string>('');

  const [stateSearch, setStateSearch] = React.useState('');
  const [districtSearch, setDistrictSearch] = React.useState('');
  const [citySearch, setCitySearch] = React.useState('');

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', message: '', targetRoles: [], targetStates: [], targetDistricts: [], targetCities: [], },
  });

  React.useEffect(() => {
    if (announcementToEdit) {
      form.reset({
        title: announcementToEdit.title,
        message: announcementToEdit.message,
        targetRoles: announcementToEdit.targetRoles,
        targetStates: announcementToEdit.targetStates || [],
        targetDistricts: announcementToEdit.targetDistricts || [],
        targetCities: announcementToEdit.targetCities || [],
      });
    } else {
      form.reset({ title: '', message: '', targetRoles: [], targetStates: [], targetDistricts: [], targetCities: [], });
    }
  }, [announcementToEdit, form]);

  const handleFormSubmit = (data: AnnouncementFormValues) => {
    if (!userProfile || !firestore) return;
    try {
      if (announcementToEdit) {
        updateAnnouncement(firestore, announcementToEdit.id, data as Partial<Announcement>);
        toast({ title: 'Success', description: 'Announcement updated.' });
      } else {
        createAnnouncement(firestore, data as any);
        toast({ title: 'Success', description: 'Announcement created.' });
      }
      setIsFormOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Something went wrong.' });
    }
  };

  const handleDelete = () => {
    if (announcementToDelete && firestore) {
      deleteAnnouncement(firestore, announcementToDelete);
      toast({ title: 'Success', description: 'Announcement deleted.' });
      setIsAlertOpen(false);
    }
  };

  const filteredStates = React.useMemo(() => states?.filter((s) => s.name.toLowerCase().includes(stateSearch.toLowerCase())) || [], [states, stateSearch]);

  const filteredDistricts = React.useMemo(() => {
    if (!allDistricts) return [];
    return allDistricts.filter(d =>
      (browseStateId ? d.stateId === browseStateId : true) &&
      d.name.toLowerCase().includes(districtSearch.toLowerCase())
    );
  }, [allDistricts, browseStateId, districtSearch]);

  const filteredCities = React.useMemo(() => {
    if (!allCities) return [];
    return allCities.filter(c =>
      (browseDistrictId ? c.districtId === browseDistrictId : true) &&
      c.name.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [allCities, browseDistrictId, citySearch]);

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <div className="text-center text-red-500 py-10"><p>Error: {error.message}</p></div>;
    if (!announcements || announcements.length === 0) return <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg"><p>No announcements found.</p></div>;

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {announcements.map((ann) => (
          <Card key={ann.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{ann.title}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs pt-1">
                <Calendar className="h-3 w-3" />
                {ann.createdAt ? format(ann.createdAt.toDate(), 'PPP') : 'Recently'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <p className="text-sm">{ann.message}</p>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {ann.targetRoles.map(r => (
                    <Badge key={r} variant="secondary">{r}</Badge>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {(!ann.targetStates?.length && !ann.targetDistricts?.length && !ann.targetCities?.length) ? 'Global targeting' : 'Location targeted'}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setAnnouncementToEdit(ann); setIsFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => { setAnnouncementToDelete(ann.id); setIsAlertOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-6">
        <Button asChild variant="outline"><Link href="/dashboard/admin"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild><Button onClick={() => { setAnnouncementToEdit(null); setBrowseStateId(''); setBrowseDistrictId(''); }}><Plus className="mr-2 h-4 w-4" />Create Announcement</Button></DialogTrigger>
          <DialogContent className="sm:max-w-xl flex flex-col h-[90vh]">
            <DialogHeader><DialogTitle>{announcementToEdit ? 'Edit' : 'Create'} Announcement</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-6 py-4">
                    <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="targetRoles" render={() => (
                      <FormItem><FormLabel>Target Roles</FormLabel><div className="grid grid-cols-2 gap-2">{availableRoles.map(r => (
                        <FormField key={r.id} control={form.control} name="targetRoles" render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value?.includes(r.id)} onCheckedChange={checked => checked ? field.onChange([...field.value, r.id]) : field.onChange(field.value.filter(v => v !== r.id))} /></FormControl><FormLabel className="font-normal">{r.label}</FormLabel></FormItem>
                        )} />
                      ))}</div><FormMessage /></FormItem>
                    )} />
                    <Separator />
                    <div className="space-y-4">
                      <Alert className="bg-muted/50"><Info className="h-4 w-4" /><AlertTitle>Targeting Logic</AlertTitle><AlertDescription className="text-xs">Checking a box below targets that <strong>entire</strong> area. To target only specific cities, find them using the filters but only check the individual City boxes.</AlertDescription></Alert>

                      <FormField control={form.control} name="targetStates" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>States</FormLabel>
                            <span className="text-[10px] text-muted-foreground italic">Check box to target entire state</span>
                          </div>
                          <Input placeholder="Search states..." value={stateSearch} onChange={e => setStateSearch(e.target.value)} />
                          <ScrollArea className="h-32 border rounded-md mt-2">
                            <div className="p-2">
                              {filteredStates.map(s => (
                                <div key={s.id} className="flex items-center justify-between mb-1 hover:bg-accent/50 p-1 rounded">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`s-${s.id}`}
                                      checked={field.value?.includes(s.id)}
                                      onCheckedChange={checked => checked ? field.onChange([...(field.value || []), s.id]) : field.onChange(field.value?.filter(v => v !== s.id))}
                                    />
                                    <Label htmlFor={`s-${s.id}`} className="font-normal capitalize">{s.name}</Label>
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setBrowseStateId(s.id)}>Browse Districts</Button>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="targetDistricts" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Districts</FormLabel>
                            <span className="text-[10px] text-muted-foreground italic">Check box to target entire district</span>
                          </div>
                          <div className="flex gap-2">
                            <Input placeholder="Search districts..." value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} className="flex-1" />
                            {browseStateId && <Button type="button" variant="outline" size="sm" onClick={() => setBrowseStateId('')}>Clear Browse Filter</Button>}
                          </div>
                          <ScrollArea className="h-32 border rounded-md mt-2">
                            <div className="p-2">
                              {filteredDistricts.length > 0 ? (
                                filteredDistricts.map(d => (
                                  <div key={d.id} className="flex items-center justify-between mb-1 hover:bg-accent/50 p-1 rounded">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`d-${d.id}`}
                                        checked={field.value?.includes(d.id)}
                                        onCheckedChange={checked => checked ? field.onChange([...(field.value || []), d.id]) : field.onChange(field.value?.filter(v => v !== d.id))}
                                      />
                                      <Label htmlFor={`d-${d.id}`} className="font-normal capitalize">{d.name}</Label>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setBrowseDistrictId(d.id)}>Browse Cities</Button>
                                  </div>
                                ))
                              ) : (
                                <p className='text-xs text-muted-foreground text-center py-4'>No districts matching filter</p>
                              )}
                            </div>
                          </ScrollArea>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="targetCities" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cities</FormLabel>
                          <div className="flex gap-2">
                            <Input placeholder="Search cities..." value={citySearch} onChange={e => setCitySearch(e.target.value)} className="flex-1" />
                            {browseDistrictId && <Button type="button" variant="outline" size="sm" onClick={() => setBrowseDistrictId('')}>Clear Browse Filter</Button>}
                          </div>
                          <ScrollArea className="h-32 border rounded-md mt-2">
                            <div className="p-2">
                              {filteredCities.length > 0 ? (
                                filteredCities.map(c => (
                                  <div key={c.id} className="flex items-center space-x-2 mb-1 hover:bg-accent/50 p-1 rounded">
                                    <Checkbox
                                      id={`ci-${c.id}`}
                                      checked={field.value?.includes(c.id)}
                                      onCheckedChange={checked => checked ? field.onChange([...(field.value || []), c.id]) : field.onChange(field.value?.filter(v => v !== c.id))}
                                    />
                                    <Label htmlFor={`ci-${c.id}`} className="font-normal capitalize">{c.name}</Label>
                                  </div>
                                ))
                              ) : (
                                <p className='text-xs text-muted-foreground text-center py-4'>No cities matching filter</p>
                              )}
                            </div>
                          </ScrollArea>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="py-4 border-t px-6"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Save</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      {renderContent()}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete the announcement permanently.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

