'use client';

import * as React from 'react';
import Image from 'next/image';
import {
    Dialog,
    DialogContent,
    DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SnapshotDialogProps {
    imageUrl: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
}

export function SnapshotDialog({
    imageUrl,
    open,
    onOpenChange,
    title = "Visitor Photo"
}: SnapshotDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl bg-black/95 border-white/10 backdrop-blur-3xl p-0 overflow-hidden">
                <div className="absolute top-4 left-4 z-20">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black uppercase tracking-widest px-3 py-1">
                        {title}
                    </Badge>
                </div>
                {imageUrl && (
                    <div className="relative aspect-square w-full">
                        <Image
                            src={imageUrl}
                            alt="Visitor snapshot"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40" />
                    </div>
                )}
                <div className="p-4 bg-[#020617] border-t border-white/5 flex justify-end">
                    <DialogClose asChild>
                        <Button className="bg-white/5 text-zinc-400 hover:text-white h-9 text-[10px] font-bold uppercase tracking-widest px-6">
                            Close
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
