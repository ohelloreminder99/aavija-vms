'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Inbox, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import Link from 'next/link';
import { format } from 'date-fns';
import { getContactSubmissions, deleteContactSubmission, type SerializableContactSubmission } from './actions';
import { useToast } from '@/hooks/use-toast';

export default function ContactSubmissionsPage() {
  const [submissions, setSubmissions] = React.useState<SerializableContactSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = React.useState<SerializableContactSubmission | null>(null);
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

  const handleDelete = async () => {
    if (!submissionToDelete) return;
    
    setIsDeleting(true);
    const result = await deleteContactSubmission(submissionToDelete.id);

    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionToDelete.id));
      toast({
        title: 'Submission Deleted',
        description: 'The message has been permanently deleted.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: result.error,
      });
    }
    setIsDeleting(false);
    setSubmissionToDelete(null);
  }

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
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => setSubmissionToDelete(submission)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <>
        <div className="container py-10">
        <div className="flex justify-between items-center mb-6">
            <Button asChild variant="outline">
            <Link href="/dashboard/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Link>
            </Button>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>Contact Form Submissions</CardTitle>
            <CardDescription>
                Messages sent from the public contact page.
            </CardDescription>
            </CardHeader>
            <CardContent>{renderContent()}</CardContent>
        </Card>
        </div>

        <AlertDialog open={!!submissionToDelete} onOpenChange={(open) => !open && setSubmissionToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the message from &quot;{submissionToDelete?.name}&quot;.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}