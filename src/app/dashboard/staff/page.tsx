'use client';

import * as React from 'react';
import { Loader2, Inbox, MessageCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { getContactSubmissions, type SerializableContactSubmission } from '../admin/contact-submissions/actions';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementsCard } from '../visitor/components/AnnouncementsCard';

export default function StaffDashboardPage() {
  const [submissions, setSubmissions] = React.useState<SerializableContactSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setIsLoading(true);
    getContactSubmissions().then(result => {
      if (result.submissions) {
        setSubmissions(result.submissions);
      } else {
        setError(result.error || 'An unknown error occurred.');
        toast({
          variant: 'destructive',
          title: 'Failed to load submissions',
          description: result.error,
        });
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, [toast]);


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 animate-pulse">Syncing Submissions...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 py-10">
          <p>An error occurred while fetching submissions.</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!submissions || submissions.length === 0) {
      return (
        <div className="py-24 text-center bg-white/[0.02] border-2 border-dashed border-white/5 rounded-3xl">
          <Inbox className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
          <p className="font-bold text-white uppercase tracking-widest text-sm">Clear Horizon</p>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-tighter">No contact submissions found.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="border-white/10">
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-8">Received</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">From</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Email</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 pr-8">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
              <TableCell className="text-[11px] font-mono text-zinc-500 whitespace-nowrap pl-8">
                {format(new Date(submission.createdAt), 'PP p')}
              </TableCell>
              <TableCell className="font-bold text-white group-hover:text-primary transition-colors">{submission.name}</TableCell>
              <TableCell>
                <a href={`mailto:${submission.email}`} className="text-primary/80 hover:text-primary transition-colors text-sm font-medium">
                  {submission.email}
                </a>
              </TableCell>
              <TableCell className="max-w-sm whitespace-pre-wrap text-zinc-400 text-sm italic pr-8 group-hover:text-zinc-200">
                "{submission.message}"
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-2">
                <AnnouncementsCard role="staff" />
            </div>
            <div className="lg:col-span-2">
                <Card className="glass-card border-white/5 overflow-hidden">
                    <CardHeader className="border-b border-white/5 pb-6">
                    <CardTitle className="flex items-center gap-3 text-white">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                            <MessageCircle className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xl font-headline tracking-tight">Contact Form Submissions</span>
                    </CardTitle>
                    <CardDescription className="text-zinc-500 font-medium ml-10">
                        Messages sent from the public contact page.
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">{renderContent()}</CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
