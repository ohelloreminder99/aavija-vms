'use client';

import * as React from 'react';
import { Edit, CheckCircle2, Search, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AgentEmailLookup } from '../AgentEmailLookup';

export function EditPremiseDialog({
    isOpen, setIsOpen, editForm, handleEditSubmit, selectedPremise,
    isSubmitting, categories, cities, filteredCities, citySearch, setCitySearch
}: any) {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                                    <FormField control={editForm.control} name="category_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Property Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-black/40 border-white/5 text-white h-11 rounded-xl">
                                                        <SelectValue placeholder="Property Type..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-black border-white/10 text-white">
                                                    {categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                                <FormField control={editForm.control} name="city_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                                            City {field.value && (
                                                <span className="text-primary ml-2 border-l border-white/10 pl-2">
                                                    {cities.find((c: any) => c.id === field.value)?.name}
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
                                                        {filteredCities.map((c: any) => (
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

                                <FormField control={editForm.control} name="agent_id" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sales Agent</FormLabel>
                                        <AgentEmailLookup 
                                            value={field.value || ''} 
                                            initialEmail={selectedPremise?.agent?.email}
                                            initialName={selectedPremise?.agent?.name}
                                            onChange={field.onChange} 
                                        />
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
    );
}
