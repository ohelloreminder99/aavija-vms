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
  Megaphone,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Syncing Broadcast Frequency...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-20 px-6 border border-red-500/20 bg-red-500/5 rounded-2xl">
          <p className="text-red-400 font-bold mb-2">Signal Interrupted</p>
          <p className="text-xs text-red-500/60 font-medium uppercase tracking-wider">{error.message}</p>
        </div>
      );
    }

    if (!announcements || announcements.length === 0) {
      return (
        <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-3xl bg-black/20">
          <Megaphone className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Zero Active Broadcasts</p>
          <p className="text-zinc-700 text-[9px] mt-2 font-medium uppercase tracking-widest">Broadcast a new signal to the network nodes.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {announcements.map((ann) => (
          <Card key={ann.id} className="glass-card border-white/5 bg-black/40 overflow-hidden relative group flex flex-col hover:border-primary/20 transition-all duration-500">
            <div className="absolute inset-0 mesh-blue opacity-0 group-hover:opacity-5 transition-opacity" />
            <CardHeader className="relative z-10 pb-0">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className="text-lg font-bold text-white tracking-tight group-hover:text-primary transition-colors">{ann.title}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setAnnouncementToEdit(ann); setIsFormOpen(true); }} className="h-8 w-8 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-white transition-all"><Edit className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setAnnouncementToDelete(ann.id); setIsAlertOpen(true); }} className="h-8 w-8 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <CardDescription className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-600 pt-1.5">
                <Calendar className="h-3 w-3" />
                {ann.createdAt ? format(ann.createdAt.toDate(), 'PPP') : 'Active Now'}
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 flex-grow pt-6 space-y-6">
              <p className="text-zinc-400 text-sm leading-relaxed">{ann.message}</p>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {ann.targetRoles.map(r => (
                    <Badge key={r} variant="outline" className="bg-white/5 border-white/5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md text-zinc-400">{r}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("h-1.5 w-1.5 rounded-full", (!ann.targetStates?.length && !ann.targetDistricts?.length && !ann.targetCities?.length) ? "bg-emerald-500" : "bg-primary/50")} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">
                    {(!ann.targetStates?.length && !ann.targetDistricts?.length && !ann.targetCities?.length) ? 'Global Wide-Target' : 'Sector Deep-Target'}
                  </span>
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <Button asChild variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retreat to Command
            </Link>
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-headline font-bold text-white tracking-tighter">
                Broadcast <span className="text-primary/80">Intelligence</span>
              </h1>
            </div>
            <p className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.2em] ml-1">
              Global announcement uplink. Dispatch priority signals and targeted updates across the mesh network.
            </p>
          </div>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setAnnouncementToEdit(null); setBrowseStateId(''); setBrowseDistrictId(''); }} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all">
              <Plus className="mr-2 h-4 w-4" /> Initialize Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl bg-black/95 border-white/10 backdrop-blur-3xl p-0 overflow-hidden h-[90vh] flex flex-col">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <DialogHeader>
                <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Signal <span className="text-primary/80">Configuration</span></DialogTitle>
                <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  Compose broadcast payload and calibrate targeting vectors.
                </DialogDescription>
              </DialogHeader>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 flex flex-col min-h-0 bg-black/40">
                <ScrollArea className="flex-1 px-8 py-8">
                  <div className="space-y-8 pb-8">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Signal Title</FormLabel>
                        <FormControl><Input placeholder="EMERGENCY_UPDATE_V2" {...field} className="bg-black/40 border-white/5 text-white h-12 rounded-xl placeholder:text-zinc-800" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Payload Content</FormLabel>
                        <FormControl><Textarea rows={4} placeholder="Decoded message string..." {...field} className="bg-black/40 border-white/5 text-white rounded-xl placeholder:text-zinc-800 resize-none" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="targetRoles" render={() => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Neural Directives (Target Roles)</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                          {availableRoles.map(r => (
                            <FormField key={r.id} control={form.control} name="targetRoles" render={({ field }) => (
                              <div className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                field.value?.includes(r.id) ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-500 hover:border-white/10"
                              )} onClick={() => field.onChange(field.value?.includes(r.id) ? field.value.filter(v => v !== r.id) : [...(field.value || []), r.id])}>
                                <FormControl><Checkbox checked={field.value?.includes(r.id)} className="sr-only" /></FormControl>
                                <Label className="text-[9px] font-black uppercase tracking-widest cursor-pointer group-hover:text-white transition-colors">{r.label}</Label>
                              </div>
                            )} />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-1">
                        <Separator className="flex-1 bg-white/5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700">Geospatial Vectors</span>
                        <Separator className="flex-1 bg-white/5" />
                      </div>

                      <Alert className="bg-white/[0.02] border-primary/20 rounded-2xl p-4">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-xs font-bold text-white mb-1">Targeting Logic</AlertTitle>
                        <AlertDescription className="text-[10px] text-zinc-500 uppercase tracking-wider leading-relaxed">
                          Enabling a Sector Node (State/District) captures all subordinate nodes. Deep-target individual sectors for precision signal injection.
                        </AlertDescription>
                      </Alert>

                      {/* State Targeting */}
                      <FormField control={form.control} name="targetStates" render={({ field }) => (
                        <FormItem className="space-y-4">
                          <div className="flex items-end justify-between px-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">State Sectors</FormLabel>
                            <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest">Toggle deep capture</span>
                          </div>
                          <div className="relative group/search">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
                            <Input placeholder="Search states..." value={stateSearch} onChange={e => setStateSearch(e.target.value)} className="pl-9 bg-black/40 border-white/5 h-10 text-xs rounded-lg" />
                          </div>
                          <div className="border border-white/5 rounded-2xl bg-black/20 overflow-hidden">
                            <ScrollArea className="h-40">
                              <div className="divide-y divide-white/5">
                                {filteredStates.map(s => (
                                  <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group/row">
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        id={`s-${s.id}`}
                                        checked={field.value?.includes(s.id)}
                                        onCheckedChange={checked => checked ? field.onChange([...(field.value || []), s.id]) : field.onChange(field.value?.filter(v => v !== s.id))}
                                        className="h-4 w-4 border-white/20 data-[state=checked]:bg-primary"
                                      />
                                      <Label htmlFor={`s-${s.id}`} className="text-xs font-bold text-zinc-400 group-hover/row:text-white transition-colors">{s.name}</Label>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" onClick={() => setBrowseStateId(s.id)}>Browse Districts</Button>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </FormItem>
                      )} />

                      {/* District Targeting */}
                      <FormField control={form.control} name="targetDistricts" render={({ field }) => (
                        <FormItem className="space-y-4">
                          <div className="flex items-end justify-between px-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">District Sectors</FormLabel>
                            {browseStateId && (
                              <button onClick={() => setBrowseStateId('')} className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline transition-all">Reset Sector Node</button>
                            )}
                          </div>
                          <div className="relative group/search">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
                            <Input placeholder="Search districts..." value={districtSearch} onChange={e => setDistrictSearch(e.target.value)} className="pl-9 bg-black/40 border-white/5 h-10 text-xs rounded-lg" />
                          </div>
                          <div className="border border-white/5 rounded-2xl bg-black/20 overflow-hidden">
                            <ScrollArea className="h-40">
                              <div className="divide-y divide-white/5">
                                {filteredDistricts.length > 0 ? (
                                  filteredDistricts.map(d => (
                                    <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group/row">
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          id={`d-${d.id}`}
                                          checked={field.value?.includes(d.id)}
                                          onCheckedChange={checked => checked ? field.onChange([...(field.value || []), d.id]) : field.onChange(field.value?.filter(v => v !== d.id))}
                                          className="h-4 w-4 border-white/20 data-[state=checked]:bg-primary"
                                        />
                                        <Label htmlFor={`d-${d.id}`} className="text-xs font-bold text-zinc-400 group-hover/row:text-white transition-colors">{d.name}</Label>
                                      </div>
                                      <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" onClick={() => setBrowseDistrictId(d.id)}>Browse Cities</Button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="py-10 text-center"><p className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">No sector match</p></div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </FormItem>
                      )} />

                      {/* City Targeting */}
                      <FormField control={form.control} name="targetCities" render={({ field }) => (
                        <FormItem className="space-y-4">
                          <div className="flex items-end justify-between px-1">
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">City Sectors</FormLabel>
                            {browseDistrictId && (
                              <button onClick={() => setBrowseDistrictId('')} className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline transition-all">Reset District Node</button>
                            )}
                          </div>
                          <div className="relative group/search">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-700 group-focus-within/search:text-primary transition-colors" />
                            <Input placeholder="Search cities..." value={citySearch} onChange={e => setCitySearch(e.target.value)} className="pl-9 bg-black/40 border-white/5 h-10 text-xs rounded-lg" />
                          </div>
                          <div className="border border-white/5 rounded-2xl bg-black/20 overflow-hidden">
                            <ScrollArea className="h-40">
                              <div className="divide-y divide-white/5">
                                {filteredCities.length > 0 ? (
                                  filteredCities.map(c => (
                                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group/row">
                                      <Checkbox
                                        id={`ci-${c.id}`}
                                        checked={field.value?.includes(c.id)}
                                        onCheckedChange={checked => checked ? field.onChange([...(field.value || []), c.id]) : field.onChange(field.value?.filter(v => v !== c.id))}
                                        className="h-4 w-4 border-white/20 data-[state=checked]:bg-primary"
                                      />
                                      <Label htmlFor={`ci-${c.id}`} className="text-xs font-bold text-zinc-400 group-hover/row:text-white transition-colors">{c.name}</Label>
                                    </div>
                                  ))
                                ) : (
                                  <div className="py-10 text-center"><p className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">No terminal sector match</p></div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </ScrollArea>
                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                  <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-500 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest px-8">Abort</Button></DialogClose>
                  <Button type="submit" className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-12 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">Inject Signal</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {renderContent()}

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white">Purge <span className="text-red-500">Signal?</span></AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
              This will irreversibly terminate the broadcast signal across all targeted neural endpoints. The data packet will be purged from the central ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-8">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-500 hover:text-white hover:bg-white/5">Abort Purge</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">Execute Purge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

