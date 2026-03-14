'use client';

import * as React from 'react';
import Image from 'next/image';
import { format, subDays } from 'date-fns';
// Dynamic imports for papaparse and jspdf moved to handleExport methods

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Download, Eye, History, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { getVisitsForVisitor } from '../actions';
import { WithId } from '@/supabase';
import { UserProfile } from '@/services/user-service';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';

type SerializableVisit = {
  id: string;
  visitor_id: string;
  visitor_name: string;
  host_id: string;
  host_name?: string;
  premise_id: string;
  checkin_time: string;
  checkout_time: string | null;
  vehicle_details?: {
    plate: string;
    model: string;
  };
  visitor_snapshot_url?: string;
  status: 'active' | 'completed' | 'declined' | 'force_closed';
};

interface VisitorHistoryDialogProps {
  visitor: WithId<UserProfile> | null;
  adminProfile: WithId<UserProfile> | null;
  premiseMap: Map<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VisitorHistoryDialog({
  visitor,
  adminProfile,
  premiseMap,
  open,
  onOpenChange,
}: VisitorHistoryDialogProps) {
  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = React.useState<Date>(new Date());
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && visitor) {
      setIsLoading(true);
      setError(null);
      setVisits([]);
      getVisitsForVisitor(visitor.id)
        .then((result) => {
          if (result.success && result.visits) {
            setVisits(result.visits);
            if (adminProfile) {
              createLogEntry({
                actorId: adminProfile.id,
                actorName: adminProfile.name,
                actorRole: 'admin',
                action: LogAction.VIEW_VISITOR_HISTORY_ADMIN,
                description: `Admin "${adminProfile.name}" viewed visit history for visitor "${visitor.name}".`,
                context: { viewedUserId: visitor.id }
              });
            }
          } else {
            setError(result.error || 'Failed to load visit history.');
          }
        })
        .catch(() => {
          setError('An unexpected error occurred.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, visitor, adminProfile]);

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];

    const fromDate = new Date(startDate);
    const toDate = new Date(endDate);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    return visits.filter((visit) => {
      const visitDate = new Date(visit.checkin_time);
      return visitDate >= fromDate && visitDate <= toDate;
    });
  }, [visits, startDate, endDate]);

  const handleExportCSV = async () => {
    const Papa = (await import('papaparse')).default;
    const dataToExport = filteredVisits.map(visit => ({
      Premise: premiseMap.get(visit.premise_id) || 'Unknown',
      'Host Met': visit.host_name || 'N/A',
      'Check-in': format(new Date(visit.checkin_time), 'PPpp'),
      'Check-out': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
      Status: visit.status,
      'Vehicle Plate': visit.vehicle_details?.plate || 'N/A',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `visitor_${visitor?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    doc.text(`Visit History for ${visitor?.name}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Premise', 'Host Met', 'Check-in', 'Check-out', 'Status', 'Vehicle']],
      body: filteredVisits.map(visit => [
        premiseMap.get(visit.premise_id) || 'Unknown',
        visit.host_name || 'N/A',
        format(new Date(visit.checkin_time), 'Pp'),
        visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
        visit.status,
        visit.vehicle_details ? visit.vehicle_details.plate : 'N/A',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 62, 80] },
    });

    doc.save(`visitor_${visitor?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl bg-[#020617]/95 backdrop-blur-3xl border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />

          <div className="relative z-10 p-8 border-b border-white/5 bg-white/[0.01]">
            <div className="flex items-start gap-6">
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-primary/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-700" />
                <Avatar className="h-20 w-20 border-2 border-white/10 relative z-10 shadow-lg">
                  {visitor?.photo_url && <AvatarImage src={visitor.photo_url} alt={visitor.name} className="object-cover" />}
                  <AvatarFallback className="bg-white/10 text-zinc-400 font-bold text-2xl uppercase">{visitor?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <History className="h-4 w-4 text-primary" />
                  </div>
                  <DialogTitle className="text-3xl font-headline font-bold text-white tracking-tight">Visit <span className="text-primary/80">History</span></DialogTitle>
                </div>
                <DialogDescription className="text-zinc-400 font-semibold uppercase tracking-[0.2em] text-[10px]">
                  Global check-in audit for {visitor?.name}
                </DialogDescription>
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6 relative overflow-hidden shadow-sm">
                <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none" />
                <div className="relative z-10 flex flex-wrap items-end gap-6 justify-between">
                  <div className="flex flex-wrap items-end gap-4">
                    <DateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      onStartDateChange={setStartDate}
                      onEndDateChange={setEndDate}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleExportCSV} disabled={filteredVisits.length === 0 || isLoading} className="h-11 bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest px-6 transition-all shadow-sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF} disabled={filteredVisits.length === 0 || isLoading} className="h-11 bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest px-6 transition-all shadow-sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden shadow-xl min-h-[300px]">
                {isLoading ? (
                  <div className="flex flex-col h-64 items-center justify-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Retrieving Records...</span>
                  </div>
                ) : error ? (
                  <div className="flex flex-col h-64 items-center justify-center space-y-4 px-8 text-center">
                    <AlertTriangle className="h-10 w-10 text-red-600/50" />
                    <p className="text-zinc-400 font-medium text-sm max-w-xs">{error}</p>
                  </div>
                ) : filteredVisits.length === 0 ? (
                  <div className="flex flex-col h-64 items-center justify-center space-y-4">
                    <div className="p-4 rounded-full bg-white/5 border border-white/5 shadow-inner">
                      <History className="h-8 w-8 text-zinc-400" />
                    </div>
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No visit logs found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-white/[0.02]">
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6 pl-8 w-16">Snapshot</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Premise</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Host Met</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Check-in</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Check-out</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 py-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.map((visit) => (
                        <TableRow key={visit.id} className="border-white/5 hover:bg-white/5 transition-colors group/row">
                          <TableCell className="pl-8 py-4">
                            <Button variant="ghost" size="icon" aria-label="View visitor snapshot" onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)} disabled={!visit.visitor_snapshot_url} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-primary hover:bg-primary/5 disabled:opacity-20 transition-all">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-white tracking-tight group-hover/row:text-primary transition-colors">{premiseMap.get(visit.premise_id) || 'Unknown'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-[11px] font-semibold text-zinc-400">{visit.host_name || 'Autonomous'}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[11px] text-zinc-400 font-semibold">{format(new Date(visit.checkin_time), 'PPp')}</span>
                          </TableCell>
                          <TableCell>
                            {visit.checkout_time ? (
                              <span className="font-mono text-[11px] text-zinc-400 font-semibold">{format(new Date(visit.checkout_time), 'PPp')}</span>
                            ) : (
                              <Badge variant="outline" className="text-[8px] bg-sky-500/5 text-sky-600 border-sky-500/20 font-black uppercase tracking-widest">Active Link</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest bg-zinc-500/10 text-zinc-400 border-zinc-500/20 font-bold">
                              {visit.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-4 bg-white/[0.02] border-t border-white/5 flex justify-end">
            <DialogClose asChild>
              <Button className="bg-black text-white hover:bg-zinc-800 h-9 text-[10px] font-black uppercase tracking-widest px-8 rounded-xl transition-all shadow-lg">Close History</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageUrlToView} onOpenChange={(open) => !open && setImageUrlToView(null)}>
        <DialogContent className="max-w-xl bg-[#020617]/95 backdrop-blur-3xl border-white/10 p-0 overflow-hidden shadow-2xl z-[70]">
          <div className="absolute top-4 left-4 z-20">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black uppercase tracking-widest px-3 py-1">Visitor Snapshot</Badge>
          </div>
          {imageUrlToView && (
            <div className="relative aspect-square w-full">
              <Image src={imageUrlToView} alt="Snapshot" fill className="object-contain" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40" />
            </div>
          )}
          <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
            <DialogClose asChild>
              <Button className="bg-black text-white hover:bg-zinc-800 h-9 text-[10px] font-bold uppercase tracking-widest px-6 rounded-lg transition-all shadow-md">Dismiss</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
