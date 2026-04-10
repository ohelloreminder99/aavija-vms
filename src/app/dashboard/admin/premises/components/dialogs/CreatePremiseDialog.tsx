'use client';

import * as React from 'react';
import {
    CheckCircle2,
    Search,
    Shield,
    Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { AgentEmailLookup } from '../AgentEmailLookup';

export function CreatePremiseDialog({
    isOpen, setIsOpen, creationMode, setCreationMode, newOwnerForm, existingUserForm, handleCreateSubmit,
    isSubmitting, categories, cities, filteredCities, citySearch, setCitySearch
}: any) {
    const createForm = creationMode === 'new' ? newOwnerForm : existingUserForm;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                                    <FormField control={createForm.control} name="category_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                                                        <SelectValue placeholder="Select type..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-black border-white/10 text-white">
                                                    {categories?.map((c: any) => <SelectItem key={c.id} value={c.id} className="focus:bg-primary focus:text-white">{c.name}</SelectItem>)}
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

                                <FormField control={createForm.control} name="city_id" render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between mb-1">
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Select City</FormLabel>
                                            {field.value && (
                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                                    Selected: {cities.find((c: any) => c.id === field.value)?.name}
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
                                                        {filteredCities.map((c: any) => (
                                                            <div key={c.id} className={cn(
                                                                "flex items-center h-10 px-4 rounded-xl transition-all cursor-pointer group",
                                                                field.value === c.id ? "bg-primary/10 text-white" : "hover:bg-white/5 text-zinc-400"
                                                            )} onClick={() => field.onChange(c.id)}>
                                                                <RadioGroupItem value={c.id} id={`c-${c.id}`} className="sr-only" />
                                                                <Label htmlFor={`c-${c.id}`} className="flex-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer">{c.name}, <span className="opacity-50">{c.state_name}</span></Label>
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

                                {creationMode === 'new' ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-2">
                                            <CheckCircle2 className="h-4 w-4 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Owner Details</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <FormField control={createForm.control} name="owner_name" render={({ field }) => (
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

                                <FormField control={createForm.control} name="agent_id" render={({ field }) => (
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
    );
}
