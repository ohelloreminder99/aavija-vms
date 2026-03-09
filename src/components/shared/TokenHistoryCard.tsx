'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Coins,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { getLogsForActorAction, getLogsForPremiseAction, getInvoiceById, SerializableLog } from '@/services/log-reader-actions';
import { useCollection } from '@/supabase';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { generateInvoicePdf } from '@/services/invoice-service';
import { useToast } from '@/hooks/use-toast';


interface TokenHistoryCardProps {
  target: { type: 'user'; id: string; role?: string } | { type: 'premise'; id: string };
  className?: string;
}

const LogItem = ({ log }: { log: SerializableLog }) => {
  const isCredit = (log.tokenChange ?? 0) > 0;
  const Icon = isCredit ? ArrowUpCircle : ArrowDownCircle;
  const colorClass = isCredit ? 'text-emerald-600' : 'text-destructive';
  const timestamp = new Date(log.timestamp);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownloadInvoice = async () => {
    const invoiceId = log.context?.invoiceId;
    if (!invoiceId) return;

    setIsDownloading(true);
    try {
      const invoice = await getInvoiceById(invoiceId);
      if (invoice) {
        await generateInvoicePdf(invoice as any);
      } else {
        toast({ variant: 'destructive', title: 'Not Found', description: 'Invoice data could not be retrieved.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate invoice PDF.' });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      <Icon className={cn('h-5 w-5 flex-shrink-0', colorClass)} />
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground leading-tight">{log.description}</p>
        <div className='flex items-center gap-4'>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground cursor-default">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{timestamp.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {log.context?.invoiceId && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary flex items-center gap-1"
              onClick={handleDownloadInvoice}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className='h-3 w-3 animate-spin' /> : <FileText className='h-3 w-3' />}
              Download Invoice
            </Button>
          )}
        </div>
      </div>
      <div
        className={cn(
          'font-mono text-sm font-semibold whitespace-nowrap ml-2',
          colorClass
        )}
      >
        {isCredit ? '+' : ''}
        {log.tokenChange?.toLocaleString()}
      </div>
    </div>
  );
};

const TokenHistoryCardComponent = ({ target, className }: TokenHistoryCardProps) => {
  const [logs, setLogs] = React.useState<SerializableLog[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Realtime Pulse: Dynamically refetch the ledger array whenever new tokens are bought or consumed
  const { data: realtimePulse } = useCollection({ table: 'logs', __memo: true });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  React.useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let result;
        if (target.type === 'user') {
          // Pass the role (visitor/host) to filter out premise transactions from personal history
          result = await getLogsForActorAction(target.id, target.role);
        } else {
          result = await getLogsForPremiseAction(target.id);
        }

        if (result.logs) {
          setLogs(result.logs);
        }

        if (result.error) {
          setError(result.error);
        }

      } catch (e: any) {
        console.error("Failed to fetch token history:", e);
        setError(e.message || 'An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    if (target.id) {
      fetchLogs();
    } else {
      setIsLoading(false);
    }
  }, [target.id, target.type, (target as any).role, pulseHash]);


  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error && (!logs || logs.length === 0)) {
      return (
        <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-destructive">
          <AlertTriangle className="h-8 w-8" />
          <p className="mt-2 font-medium">Could not load token history.</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      );
    }

    if (!logs || logs.length === 0) {
      return (
        <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
          <Info className="h-8 w-8" />
          <p className="mt-2 text-sm">No token transactions found.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-72 pr-4">
        <div className="flex flex-col">
          {logs.map((log) => (
            <LogItem key={log.id} log={log} />
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Token History & Invoices
        </CardTitle>
        <CardDescription>A log of your recent token transactions and invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && logs && logs.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Incomplete History</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderContent()}
      </CardContent>
    </Card>
  );
}

export const TokenHistoryCard = React.memo(TokenHistoryCardComponent);