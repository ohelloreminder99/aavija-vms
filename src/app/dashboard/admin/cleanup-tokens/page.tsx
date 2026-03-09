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
import { ArrowLeft, Loader2, QrCode, Sparkles, ExternalLink, Info } from 'lucide-react';
import { cleanupQrTokens } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CleanupTokensPage() {
  const [isCleaning, startCleanupTransition] = useTransition();
  const { toast } = useToast();

  const handleCleanup = () => {
    startCleanupTransition(async () => {
      const result = await cleanupQrTokens();
      if (result.success) {
        if ((result.count || 0) > 0) {
          toast({
            title: 'Cleanup Complete',
            description: `Successfully removed ${result.count} expired or used tokens.`,
          });
        } else {
          toast({
            title: 'Database Clean',
            description: 'No expired or orphaned tokens were found.',
          });
        }
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
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            QR Token Manual Cleanup
          </CardTitle>
          <CardDescription>
            Clear out orphaned QR check-in tokens that have either expired or were abandoned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              Tokens are normally deleted automatically once a visitor checks in. However, if a visitor generates a code and never uses it, these records can remain in the database.
            </p>
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={handleCleanup}
            disabled={isCleaning}
          >
            {isCleaning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Run Manual Sweep
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Automated Token Cleanup</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>Instead of manual deletion, tokens auto-delete using PostgreSQL cron jobs:</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs">
            <li>Configure the <strong>Visitor Token Validity (days)</strong> in Global Settings.</li>
            <li>Open the <strong>Supabase Dashboard</strong>.</li>
            <li>Go to <strong>Database</strong> &gt; <strong>Extensions</strong>.</li>
            <li>Enable the <code>pg_cron</code> extension to allow automated TTL sweeps.</li>
          </ol>
          <Button variant="link" className="p-0 h-auto text-xs" asChild>
            <a href="https://supabase.com/dashboard/" target="_blank" rel="noopener noreferrer">
              Open Supabase Dashboard <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
