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
import { Loader2, Download, Star, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getVisitsForVisitor } from '../actions';
import { WithId } from '@/supabase';
import { UserProfile } from '@/services/user-service';
import { Separator } from '@/components/ui/separator';
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
  const [startDate, setStartDate] = React.useState<string>(format(addDays(new Date(), -30), 'dd/MM/yyyy'));
  const [endDate, setEndDate] = React.useState<string>(format(new Date(), 'dd/MM/yyyy'));
  const [dateError, setDateError] = React.useState<string | null>(null);
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
            if (adminProfile && visitor) {
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
        .catch((e) => {
            setError('An unexpected error occurred.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, visitor, adminProfile]);
  
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
    const dataToExport = filteredVisits.map(visit => ({
        Premise: premiseMap.get(visit.premise_id) || 'Unknown Premise',
        'Host Met': visit.host_name || 'Unknown',
        'Check-in': format(new Date(visit.checkin_time), 'PPpp'),
        'Check-out': visit.checkout_time ? format(new Date(visit.checkout_time), 'PPpp') : 'N/A',
        Status: visit.status,
        'Vehicle Plate': visit.vehicle_details?.plate || 'N/A',
        'Vehicle Model': visit.vehicle_details?.model || 'N/A',
        'Snapshot URL': visit.visitor_snapshot_url || 'N/A',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `visitor_${visitor?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Visit History for ${visitor?.name}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Report generated on: ${format(new Date(), 'PPpp')}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [['Premise', 'Host Met', 'Check-in', 'Check-out', 'Status', 'Vehicle']],
      body: filteredVisits.map(visit => [
        premiseMap.get(visit.premise_id) || 'Unknown',
        visit.host_name || 'Unknown',
        format(new Date(visit.checkin_time), 'Pp'),
        visit.checkout_time ? format(new Date(visit.checkout_time), 'Pp') : 'N/A',
        visit.status,
        visit.vehicle_details ? `${visit.vehicle_details.plate} (${visit.vehicle_details.model})` : 'N/A',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 62, 80] },
    });
    
    doc.save(`visitor_${visitor?.name}_history_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
              <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16 border">
                      {visitor?.photo_url && <AvatarImage src={visitor.photo_url} alt={visitor.name} />}
                      <AvatarFallback>{visitor?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                      <DialogTitle>Visit History for {visitor?.name}</DialogTitle>
                      <DialogDescription>
                        Showing all check-ins for this visitor across all premises.
                      </DialogDescription>
                  </div>
              </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-end gap-2">
                  <div>
                      <Label htmlFor="start-date-visitor" className="text-xs text-muted-foreground">From</Label>
                      <Input
                          id="start-date-visitor"
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={startDate}
                          onChange={(e) => handleDateInputChange(e.target.value, setStartDate)}
                          className="w-[150px]"
                          maxLength={10}
                      />
                  </div>
                  <div>
                      <Label htmlFor="end-date-visitor" className="text-xs text-muted-foreground">To</Label>
                      <Input
                          id="end-date-visitor"
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
                  {isLoading && (
                      <div className="flex h-48 items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                  )}
                  {error && (
                      <div className="flex h-48 items-center justify-center text-destructive">
                          <p>{error}</p>
                      </div>
                  )}
                  {!isLoading && !error && filteredVisits.length === 0 && !dateError && (
                      <div className="flex h-48 items-center justify-center text-muted-foreground">
                          <p>No visit history found for this visitor for the selected date range.</p>
                      </div>
                  )}
                  {!isLoading && !error && filteredVisits.length > 0 && (
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Snapshot</TableHead>
                                  <TableHead>Premise</TableHead>
                                  <TableHead>Host Met</TableHead>
                                  <TableHead>Vehicle</TableHead>
                                  <TableHead>Check-in</TableHead>
                                  <TableHead>Check-out</TableHead>
                                  <TableHead>Status</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredVisits.map((visit) => (
                              <TableRow key={visit.id}>
                                  <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => setImageUrlToView(visit.visitor_snapshot_url || null)} disabled={!visit.visitor_snapshot_url}>
                                          <Eye className="h-4 w-4" />
                                      </Button>
                                  </TableCell>
                                  <TableCell>{premiseMap.get(visit.premise_id) || 'Unknown Premise'}</TableCell>
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
                              ))}
                          </TableBody>
                      </Table>
                  )}
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

