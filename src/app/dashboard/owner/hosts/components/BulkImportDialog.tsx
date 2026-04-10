'use client';

import * as React from 'react';
import { FileUp, Upload, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { bulkEnrollHosts } from '@/services/bulk-member-service';
import { useRouter } from 'next/navigation';

interface BulkImportDialogProps {
    premiseId?: string;
    userId?: string;
    userName?: string;
}

export function BulkImportDialog({ premiseId, userId, userName }: BulkImportDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = React.useState(false);
    const [progress, setProgress] = React.useState<number | null>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !premiseId || !userId || !userName) return;

        setProgress(0);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(line => line.trim());
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                
                const data = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const obj: any = {};
                    headers.forEach((header, i) => {
                        obj[header] = values[i];
                    });
                    return obj;
                });

                const result = await bulkEnrollHosts(
                    premiseId,
                    data,
                    { id: userId, name: userName, role: 'owner' }
                );

                if (result.success) {
                    setProgress(100);
                    toast({ title: 'Bulk Enrollment Complete', description: `Successfully processed ${result.count} hosts.` });
                    router.refresh();
                    setIsOpen(false);
                } else {
                    toast({ variant: 'destructive', title: 'Bulk Enrollment Failed', description: result.errors.join(', ') || 'Unknown error' });
                }
                setProgress(null);
            };
            reader.readAsText(file);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error Reading File', description: 'Failed to parse CSV file.' });
            setProgress(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-11 border-white/5 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-white/10 text-zinc-400">
                    <FileUp className="h-4 w-4" />
                    Bulk Import
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#010a05]/95 border-white/10 backdrop-blur-2xl max-w-2xl">
                <DialogHeader className="space-y-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <FileUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">Bulk Enroll Hosts</DialogTitle>
                        <DialogDescription className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mt-1">
                            Upload a CSV file to enroll multiple hosts at once
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors">
                        <input 
                            type="file" 
                            className="hidden" 
                            id="csv-upload" 
                            accept=".csv"
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer">
                            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                                <Upload className="h-8 w-8 text-zinc-500 group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-white font-bold text-[13px] tracking-tight">Click to upload CSV</p>
                            <p className="text-zinc-400 text-[10px] uppercase font-medium mt-1">Maximum 5000 records at a time</p>
                        </label>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Bulk Enrollment Status</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                                onClick={() => {
                                    const csvContent = "name,email,password,identity\nJohn Doe,john@example.com,password123,A-101\nJane Smith,jane@example.com,password123,B-202";
                                    const blob = new Blob([csvContent], { type: 'text/csv' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'aavija-hosts-template.csv';
                                    a.click();
                                }}
                            >
                                <FileUp className="mr-2 h-3.3 w-3.3" /> Download Sample CSV
                            </Button>
                        </div>
                        <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Info className="h-3 w-3" />
                            Required CSV Headers:
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {['name', 'email', 'identity', 'password'].map(header => (
                                <span key={header} className="bg-black/50 text-white text-[9px] font-mono px-2 py-1 rounded border border-white/10">
                                    {header}
                                </span>
                            ))}
                        </div>
                    </div>

                    {progress !== null && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-zinc-400">Processing...</span>
                                <span className="text-primary">{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
