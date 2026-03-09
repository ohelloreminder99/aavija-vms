
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format, addDays, parse } from 'date-fns';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Building, Loader2, Download, User, Star, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getVisitsForPremise } from '../actions';
import { WithId } from '@/supabase';
import { Premise } from '@/services/premise-service';
import { UserProfile } from '@/services/user-service';

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

interface PremiseHistoryDialogProps {
  premise: WithId<Premise> | null;
  allUsers: WithId<UserProfile>[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_SIZE = 20;

export default function PremiseHistoryDialog({
  premise,
  allUsers,
  open,
  onOpenChange,
}: PremiseHistoryDialogProps) {
  const [visits, setVisits] = React.useState<SerializableVisit[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastVisible, setLastVisible] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);
  
  const [startDate, setStartDate] = React.useState<string>(format(addDays(new Date(), -30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);

  const userMap = React.useMemo(() => {
    if (!allUsers) return new Map<string, WithId<UserProfile>>();
    return new Map(allUsers.map(u => [u.id, u]));
  }, [allUsers]);

  const fetchVisits = React.useCallback(async (loadMore = false) => {
    if (!premise) return;
    
    if (loadMore) {
        setIsLoadingMore(true);
    } else {
        setIsLoading(true);
        setVisits([]);
        setLastVisible(undefined);
        setHasMore(true);
    }
    setError(null);

    try {
        const result = await getVisitsForPremise({
            premiseId: premise.id,
            limit: PAGE_SIZE,
            startAfter: loadMore ? lastVisible : undefined
        });

        if (result.success && result.visits) {
            setVisits(prev => loadMore ? [...prev, ...result.visits!] : result.visits!);
            setLastVisible(result.lastVisible);
            setHasMore(result.visits.length === PAGE_SIZE);
        } else {
            setError(result.error || 'Failed to load visit history.');
        }
    } catch(e: any) {
        setError('An unexpected error occurred.');
    } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
    }
  }, [premise, lastVisible]);


  React.useEffect(() => {
    if (open && premise) {
      fetchVisits(false);
    }
  }, [open, premise]); // Removed fetchVisits from dependency array to prevent re-fetching on its own change

  const handleDateInputChange = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const digitsOnly = value.replace(/\D/g, '');
    let formattedDate = digitsOnly;

    if (digitsOnly.length > 4) {
      formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(
        2,
        4
      )}/${digitsOnly.slice(4, 8)}`;
    } else if (digitsOnly.length > 2) {
      formattedDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    }
    
    setter(formattedDate);
  };

  const filteredVisits = React.useMemo(() => {
    if (!visits) return [];
    setDateError(null);
    try {
      const fromDate = parse(startDate, 'dd/MM/yyyy', new Date());
      const toDate = parse(endDate, 'dd/MM/yyyy', new Date());
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        setDateError('Invalid date format. Please use DD/MM/YYYY.');
        return [];
      }
      
      if (fromDate > toDate) {
        setDateError('Start date cannot be after end date.');
        return [];
      }

      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      return visits.filter((visit) => {
        const visitDate = new Date(visit.checkin_time);
        return visitDate >= fromDate && visitDate <= toDate;
      });
    } catch (e) {
      setDateError('An error occurred while parsing dates.');
      return [];
    }
  }, [visits, startDate, endDate]);

  const handleExportCSV = () => {
    const dataToExport = filteredVisits.map(visit => {
        return {
            Visitor: visit.visitor_name,
            'Host Met': visit.host_name || 'Unknown',
            'Check-in': format(new Date(visit.checkin_time), 'PPpp'),
            'Check-out': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
            Status: visit.status,
            'Vehicle Plate': visit.vehicle_details?.plate || 'N/A',
            'Vehicle Model': visit.vehicle_details?.model || 'N/A',
            'Snapshot URL': visit.visitor_snapshot_url || 'N/A',
        }
    });

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `premise_${premise?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Visit History for ${premise?.name}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Visitor', 'Host Met', 'Check-in', 'Check-out', 'Status', 'Vehicle']],
      body: filteredVisits.map(visit => {
        return [
            visit.visitor_name,
            visit.host_name || 'Unknown',
            format(new Date(visit.checkin_time), 'Pp'),
            visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
            visit.status,
            visit.vehicle_details ? `${visit.vehicle_details.plate} (${visit.vehicle_details.model})` : 'N/A',
        ]
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 62, 80] },
    });
    
    doc.save(`premise_${premise?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-48 items-center justify-center text-destructive">
          <p>{error}</p>
        </div>
      );
    }
    if (filteredVisits.length === 0 && !dateError) {
      return (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <p>No visit history found for the selected date range.</p>
        </div>
      );
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Snapshot</TableHead>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Host Met</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredVisits.map((visit) => {
                    return (
                    <TableRow key={visit.id}>
                         <TableCell>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)}
                                disabled={!visit.visitor_snapshot_url}
                                >
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        <TableCell>
                            <div className="font-medium">{visit.visitor_name}</div>
                        </TableCell>
                        <TableCell>{visit.host_name || <span className="text-muted-foreground text-xs">Unknown</span>}</TableCell>
                        <TableCell>
                            {visit.vehicle_details ? (
                                <div className='text-xs'>
                                    <div className='font-medium'>{visit.vehicle_details.plate}</div>
                                    <div className='text-muted-foreground'>{visit.vehicle_details.model}</div>
                                </div>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        <TableCell>{format(new Date(visit.checkin_time), 'PPp')}</TableCell>
                        <TableCell>
                        {visit.checkout_time ? format(new Date(visit.checkout_time), 'PPp') : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        <TableCell>
                        <Badge variant={visit.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {visit.status.replace('_', ' ')}
                        </Badge>
                        </TableCell>
                    </TableRow>
                )})}
            </TableBody>
        </Table>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
            <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted">
                    <Building className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <DialogTitle>Visit History for {premise?.name}</DialogTitle>
                    <DialogDescription>
                        Showing all check-ins for this premise.
                    </DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-end gap-2">
                <div>
                    <Label htmlFor="start-date" className="text-xs text-muted-foreground">From</Label>
                    <Input
                        id="start-date"
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={startDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setStartDate)}
                        className="w-[150px]"
                        maxLength={10}
                    />
                </div>
                <div>
                    <Label htmlFor="end-date" className="text-xs text-muted-foreground">To</Label>
                    <Input
                        id="end-date"
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={endDate}
                        onChange={(e) => handleDateInputChange(e.target.value, setEndDate)}
                        className="w-[150px]"
                        maxLength={10}
                    />
                </div>
            </div>
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
            <div className='flex items-center gap-2 ml-auto'>
                <Button variant="outline" onClick={handleExportCSV} disabled={filteredVisits.length === 0 || isLoading || !!dateError}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
                <Button variant="outline" onClick={handleExportPDF} disabled={filteredVisits.length === 0 || isLoading || !!dateError}>
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                </Button>
            </div>
        </div>

        <div className="max-h-[55vh]">
            <ScrollArea className="h-full">
                {renderTableContent()}
                <div className="mt-6 flex justify-center">
                    {hasMore && (
                        <Button
                            onClick={() => fetchVisits(true)}
                            disabled={isLoadingMore}
                            variant="outline"
                        >
                            {isLoadingMore ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Load More
                        </Button>
                    )}
                </div>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!imageUrlToView} onOpenChange={() => setImageUrlToView(null)}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Visitor Snapshot</DialogTitle>
            </DialogHeader>
            {imageUrlToView && (
                <div className="relative aspect-square w-full">
                    <Image
                        src={imageUrlToView}
                        alt="Visitor snapshot"
                        fill
                        className="object-contain rounded-md"
                    />
                </div>
            )}
        </DialogContent>
    </Dialog>
    </>
  );
}

