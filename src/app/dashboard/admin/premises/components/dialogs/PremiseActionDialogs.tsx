'use client';

import * as React from 'react';
import { Trash2, Loader2, Users, Shield } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function DeletePremiseDialog({
    isOpen, setIsOpen, handleDeleteConfirm, selectedPremise, isSubmitting
}: any) {
    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
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
    );
}

export function ChangeOwnerDialog({
    isOpen, setIsOpen, handleChangeOwnerSubmit, premiseToChangeOwner, newOwnerEmail, setNewOwnerEmail, isSubmitting
}: any) {
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
    );
}

export function DuplicateUserDialog({
    isOpen, setIsOpen
}: any) {
    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
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
                    <AlertDialogAction onClick={() => setIsOpen(false)} className="bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-10 hover:bg-amber-600">Close</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
