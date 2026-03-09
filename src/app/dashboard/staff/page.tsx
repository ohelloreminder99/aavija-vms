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
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
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
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <Inbox className="mx-auto h-12 w-12" />
          <p className="mt-4 mb-2">No contact submissions found.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Received</TableHead>
            <TableHead>From</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(submission.createdAt), 'PP p')}
              </TableCell>
              <TableCell className="font-medium">{submission.name}</TableCell>
              <TableCell>
                <a href={`mailto:${submission.email}`} className="text-primary hover:underline">
                  {submission.email}
                </a>
              </TableCell>
              <TableCell className="max-w-sm whitespace-pre-wrap">{submission.message}</TableCell>
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
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <MessageCircle className="h-6 w-6" />
                        <span>Contact Form Submissions</span>
                    </CardTitle>
                    <CardDescription>
                        Messages sent from the public contact page.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>{renderContent()}</CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
