'use client';

import * as React from 'react';
import {
    Building,
    Shield,
    Loader2,
    Search,
    Edit,
    CheckCircle2,
    Trash2,
    Plus,
    Users
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AgentEmailLookup } from './AgentEmailLookup';

interface PremiseDialogsProps {
    // Create Dialog State
    isCreateOpen: boolean;
    setIsCreateOpen: (open: boolean) => void;
    creationMode: 'new' | 'existing';
    setCreationMode: (mode: 'new' | 'existing') => void;
    newOwnerForm: any;
    existingUserForm: any;
    handleCreateSubmit: (data: any) => void;

    // Edit Dialog State
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    editForm: any;
    handleEditSubmit: (data: any) => void;
    selectedPremise: any;

    // Delete Dialog State
    isDeleteAlertOpen: boolean;
    setIsDeleteAlertOpen: (open: boolean) => void;
    handleDeleteConfirm: () => void;

    // Change Owner Dialog State
    isChangeOwnerOpen: boolean;
    setIsChangeOwnerOpen: (open: boolean) => void;
    premiseToChangeOwner: any;
    newOwnerEmail: string | null;
    setNewOwnerEmail: (email: string) => void;
    handleChangeOwnerSubmit: (e: React.FormEvent) => void;

    // Duplicate User Dialog State
    showDuplicateUserDialog: boolean;
    setShowDuplicateUserDialog: (show: boolean) => void;

    // Shared Props
    isSubmitting: boolean;
    categories: any[];
    cities: any[];
    filteredCities: any[];
    citySearch: string;
    setCitySearch: (search: string) => void;
}

export function PremiseDialogs({
    isCreateOpen, setIsCreateOpen, creationMode, setCreationMode, newOwnerForm, existingUserForm, handleCreateSubmit,
    isEditOpen, setIsEditOpen, editForm, handleEditSubmit, selectedPremise,
    isDeleteAlertOpen, setIsDeleteAlertOpen, handleDeleteConfirm,
    isChangeOwnerOpen, setIsChangeOwnerOpen, premiseToChangeOwner, newOwnerEmail, setNewOwnerEmail, handleChangeOwnerSubmit,
    showDuplicateUserDialog, setShowDuplicateUserDialog,
    isSubmitting, categories, cities, filteredCities, citySearch, setCitySearch
}: PremiseDialogsProps) {

    const createForm = creationMode === 'new' ? newOwnerForm : existingUserForm;

    return (
        <>
            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-xl bg-black/90 border-white/10 backdrop-blur-2xl p-0 overflow-hidden flex flex-col h-[90vh] max-h-[800px]">
                    <div className="p-8 border-b border-white/5 bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Add <span className="text-primary/80">New Property</span></DialogTitle>
                                </div>
                            </div>
                            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                Create a new building or property in the Aavija system.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-8">
                            <RadioGroup value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="grid grid-cols-2 gap-4">
                                <div className={cn(
                                    "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                                    creationMode === 'new' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                                )} onClick={() => setCreationMode('new')}>
                                    <RadioGroupItem value="new" id="r1" className="sr-only" />
                                    <Label htmlFor="r1" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">New Owner</Label>
                                    {creationMode === 'new' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                                </div>
                                <div className={cn(
                                    "relative flex items-center justify-center h-12 rounded-xl border transition-all cursor-pointer group",
                                    creationMode === 'existing' ? "bg-primary/10 border-primary/30 text-white" : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                                )} onClick={() => setCreationMode('existing')}>
                                    <RadioGroupItem value="existing" id="r2" className="sr-only" />
                                    <Label htmlFor="r2" className="font-black uppercase tracking-widest text-[9px] cursor-pointer">Existing User</Label>
                                    {creationMode === 'existing' && <div className="absolute inset-0 bg-primary/5 blur-xl pointer-events-none" />}
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    <Form key={creationMode} {...createForm}>
                        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="flex-1 flex flex-col min-h-0 bg-black/40">
                            <ScrollArea className="flex-1">
                                <div className="space-y-8 p-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField control={createForm.control} name="premiseName" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Name</FormLabel>
                                                <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" placeholder="e.g., Royal Society" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={createForm.control} name="categoryId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                                                            <SelectValue placeholder="Select type..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-black border-white/10 text-white">
                                                        {categories?.map(c => <SelectItem key={c.id} value={c.id} className="focus:bg-primary focus:text-white">{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>

                                    <FormField control={createForm.control} name="premiseAddress" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Address</FormLabel>
                                            <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" placeholder="Enter Full Address..." /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={createForm.control} name="cityId" render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between mb-1">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Select City</FormLabel>
                                                {field.value && (
                                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                                        Selected: {cities.find(c => c.id === field.value)?.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                                    <Input placeholder="Search city name..." className="pl-9 bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                                                </div>
                                                <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/40 p-2">
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                                                            {filteredCities.map(c => (
                                                                <div key={c.id} className={cn(
                                                                    "flex items-center h-10 px-4 rounded-xl transition-all cursor-pointer group",
                                                                    field.value === c.id ? "bg-primary/10 text-white" : "hover:bg-white/5 text-zinc-400"
                                                                )} onClick={() => field.onChange(c.id)}>
                                                                    <RadioGroupItem value={c.id} id={`c-${c.id}`} className="sr-only" />
                                                                    <Label htmlFor={`c-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">{c.name}, <span className="opacity-50">{c.stateName}</span></Label>
                                                                    {field.value === c.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                </ScrollArea>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="h-px bg-white/5" />

                                    12:                                    {creationMode === 'new' ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Owner Details</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <FormField control={createForm.control} name="ownerName" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Owner Name</FormLabel>
                                                        <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={createForm.control} name="ownerEmail" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email ID</FormLabel>
                                                        <FormControl><Input type="email" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FormField control={createForm.control} name="ownerPassword" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Password</FormLabel>
                                                    <FormControl><Input type="password" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    ) : (
                                        <FormField control={createForm.control} name="ownerEmail" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Linked Email</FormLabel>
                                                <FormControl><Input type="email" {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" placeholder="owner@aavija.com" /></FormControl>
                                                <FormDescription className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Assign an existing user as the owner of this property.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}

                                    <div className="h-px bg-white/5" />

                                    <FormField control={createForm.control} name="agentId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sales Agent</FormLabel>
                                            <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t border-white/5 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] flex justify-end gap-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                                    Add Property
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-xl bg-black/90 border-white/10 backdrop-blur-2xl p-0 overflow-hidden flex flex-col h-[90vh] max-h-[800px]">
                    <div className="p-8 border-b border-white/5 bg-[#010a05]/95 backdrop-blur-3xl/[0.02]">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <Edit className="h-5 w-5 text-primary" />
                                </div>
                                <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Edit <span className="text-primary/80">Property</span></DialogTitle>
                            </div>
                            <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                Update details for: <span className="text-white font-bold">{selectedPremise?.name}</span>
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="flex-1 flex flex-col min-h-0 bg-black/40">
                            <ScrollArea className="flex-1">
                                <div className="space-y-8 p-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField control={editForm.control} name="name" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Name</FormLabel>
                                                <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={editForm.control} name="categoryId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                                                            <SelectValue placeholder="Property Type..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-black border-white/10 text-white">
                                                        {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                    <FormField control={editForm.control} name="address" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Address</FormLabel>
                                            <FormControl><Input {...field} className="bg-black/40 border-white/5 text-white h-11 rounded-xl" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={editForm.control} name="cityId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                                                City {field.value && (
                                                    <span className="text-primary ml-2 border-l border-white/10 pl-2">
                                                        {cities.find(c => c.id === field.value)?.name}
                                                    </span>
                                                )}
                                            </FormLabel>
                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                                    <Input placeholder="Search city..." className="pl-10 bg-black/40 border-white/5 text-white h-11 rounded-xl" value={citySearch} onChange={(e) => setCitySearch(e.target.value)} />
                                                </div>
                                                <ScrollArea className="h-40 w-full rounded-2xl border border-white/5 bg-black/40 p-2">
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-1">
                                                            {filteredCities.map(c => (
                                                                <div key={c.id} className={cn(
                                                                    "flex items-center h-10 px-4 rounded-xl transition-all cursor-pointer",
                                                                    field.value === c.id ? "bg-primary/10 text-white" : "hover:bg-white/5 text-zinc-400"
                                                                )} onClick={() => field.onChange(c.id)}>
                                                                    <RadioGroupItem value={c.id} id={`e-c-${c.id}`} className="sr-only" />
                                                                    <Label htmlFor={`e-c-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">{c.name}</Label>
                                                                    {field.value === c.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                </ScrollArea>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <div className="h-px bg-white/5" />

                                    <FormField control={editForm.control} name="agentId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sales Agent</FormLabel>
                                            <AgentEmailLookup value={field.value || ''} onChange={field.onChange} />
                                            <FormMessage />
                                        </FormItem>
                                    )} />

                                    <FormField control={editForm.control} name="is_active" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-6">
                                            <div className="space-y-1">
                                                <FormLabel className="text-sm font-bold text-white tracking-tight">Property Status</FormLabel>
                                                <FormDescription className="text-[10px] text-zinc-400 font-medium uppercase tracking-tight">Toggle to temporarily deactivate this property.</FormDescription>
                                            </div>
                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </ScrollArea>
                            <div className="p-8 border-t border-white/5 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] flex justify-end gap-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    Commit Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Trash2 className="h-5 w-5 text-red-500" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white">Delete <span className="text-red-500">Property?</span></AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            This will permanently remove <span className="text-white font-bold">{selectedPremise?.name}</span> from the system.
                            The owner and staff will lose access to this building.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 pt-8">
                        <AlertDialogCancel disabled={isSubmitting} className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Property
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Duplicate User Collision Dialog */}
            <AlertDialog open={showDuplicateUserDialog} onOpenChange={setShowDuplicateUserDialog}>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Shield className="h-5 w-5 text-amber-500" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-bold tracking-tight text-white font-headline">Identity <span className="text-amber-500">Collision</span></AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-zinc-400 leading-relaxed text-sm">
                            The email provided is already associated with an account in the system.
                            Please select <span className="text-white font-black uppercase tracking-widest text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10">Existing User</span> instead of "New Owner" to securely link the existing account to this property.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6">
                        <AlertDialogAction onClick={() => setShowDuplicateUserDialog(false)} className="bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:bg-amber-600">Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Change Owner Dialog */}
            <Dialog open={isChangeOwnerOpen} onOpenChange={setIsChangeOwnerOpen}>
                <DialogContent className="sm:max-w-md bg-black/90 border-white/10 backdrop-blur-2xl p-8">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <DialogTitle className="text-2xl font-bold text-white tracking-tight">Ownership <span className="text-primary/80">Transfer</span></DialogTitle>
                        </div>
                        <DialogDescription className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            Transfer ownership control for property: <span className="text-white">{premiseToChangeOwner?.name}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleChangeOwnerSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">New Owner Email</Label>
                            <Input type="email" required value={newOwnerEmail || ''} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="owner@aavija.com" className="bg-black/40 border-white/5 text-white h-11 rounded-xl placeholder:text-zinc-300" />
                        </div>
                        <div className="flex justify-end gap-4 pt-4">
                            <DialogClose asChild><Button type="button" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] h-11 px-8 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Transfer Ownership'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
