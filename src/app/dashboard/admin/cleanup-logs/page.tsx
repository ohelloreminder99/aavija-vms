'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, Trash2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { deleteAllLogs } from './actions';
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
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function CleanupLogsPage() {
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();

  const handleDeleteConfirm = () => {
    setIsAlertOpen(false);
    startDeleteTransition(async () => {
      const result = await deleteAllLogs();
      if (result.success) {
        toast({
          title: 'Logs Cleared',
          description: 'All audit log entries have been permanently deleted.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Cleanup Failed',
          description: result.error || 'An unexpected error occurred.',
        });
      }
    });
  };

  return (
    <div className="container py-10 max-w-3xl mx-auto space-y-6">
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cleanup Audit Logs</CardTitle>
          <CardDescription>
            Permanently delete all audit log entries from the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Destructive Action</AlertTitle>
              <AlertDescription>
                This action is irreversible. All historical log data will be permanently removed. This is useful for clearing out old or malformed data but should be used with extreme caution.
              </AlertDescription>
          </Alert>
          
          <Button
            variant="destructive"
            onClick={() => setIsAlertOpen(true)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete All Logs
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Automated Log Retention</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>Instead of manual deletion, logs auto-delete after the specified TTL using PostgreSQL cron jobs:</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs">
            <li>Configure the <strong>Audit Log TTL (days)</strong> in History Settings.</li>
            <li>Open the <strong>Supabase Dashboard</strong>.</li>
            <li>Go to <strong>Database</strong> &gt; <strong>Extensions</strong>.</li>
            <li>Ensure the <code>pg_cron</code> extension is enabled to allow the automated sweep.</li>
          </ol>
          <Button variant="link" className="p-0 h-auto text-xs" asChild>
            <a href="https://supabase.com/dashboard/" target="_blank" rel="noopener noreferrer">
              Open Supabase Dashboard <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete every single audit log entry in the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
