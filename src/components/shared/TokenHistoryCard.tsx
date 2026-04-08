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
  const isCredit = (log.token_change ?? 0) > 0;
  const Icon = isCredit ? ArrowUpCircle : ArrowDownCircle;
  const colorClass = isCredit ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]';
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
    <div className="flex items-center gap-4 py-4 px-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group/row">
      <div className={cn('p-2 rounded-lg bg-white/5 border border-white/5 group-hover/row:border-white/10 transition-all', colorClass)}>
        <Icon className="h-5 w-5 flex-shrink-0" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm text-zinc-200 leading-tight font-medium group-hover/row:text-white transition-colors">{log.description}</p>
        <div className='flex items-center gap-4'>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 cursor-default">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </p>
              </TooltipTrigger>
              <TooltipContent className="bg-black border-white/10 text-white">
                <p>{timestamp.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {log.context?.invoiceId && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1"
              onClick={handleDownloadInvoice}
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className='h-3 w-3 animate-spin' /> : <FileText className='h-3 w-3' />}
              Invoice
            </Button>
          )}
        </div>
      </div>
      <div
        className={cn(
          'font-mono text-base font-bold whitespace-nowrap ml-4 tabular-nums',
          colorClass
        )}
      >
        {isCredit ? '+' : ''}
        {log.token_change?.toLocaleString()}
      </div>
    </div>
  );
};

const TokenHistoryCardComponent = ({ target, className }: TokenHistoryCardProps) => {
  const [logs, setLogs] = React.useState<SerializableLog[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { data: realtimePulse } = useCollection({
    table: 'logs',
    filters:
      target.type === 'user'
        ? [{ column: 'actor_id', operator: 'eq', value: target.id }]
        : [{ column: 'premise_id', operator: 'eq', value: target.id }],
    __memo: true
  });
  const pulseHash = realtimePulse ? realtimePulse.length : 0;

  React.useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let result;
        if (target.type === 'user') {
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
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Loading...</p>
        </div>
      );
    }

    if (error && (!logs || logs.length === 0)) {
      return (
        <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-red-500 bg-red-500/5 border border-red-500/10 rounded-2xl">
          <AlertTriangle className="h-10 w-10 mb-4" />
          <p className="font-bold uppercase tracking-tight">History Sync Failure</p>
          <p className="mt-1 text-[10px] text-red-500/70 max-w-[200px]">{error}</p>
        </div>
      );
    }

    if (!logs || logs.length === 0) {
      return (
        <div className="flex h-64 flex-col items-center justify-center text-zinc-600 bg-white/[0.01] border border-white/5 border-dashed rounded-2xl">
          <Info className="h-10 w-10 mb-4 opacity-20" />
          <p className="font-bold uppercase tracking-[0.2em] text-[10px]">No Transactions</p>
          <p className="text-[10px] text-zinc-700 mt-1">No token transactions found in your history.</p>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[450px] pr-4">
        <div className="flex flex-col">
          {logs.map((log) => (
            <LogItem key={log.id} log={log} />
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className={cn("glass-card border-white/5 shadow-2xl overflow-hidden relative", className)}>
      <div className="absolute inset-0 mesh-obsidian opacity-10 pointer-events-none" />
      <CardHeader className="relative z-10 border-b border-white/5 pb-8">
        <CardTitle className="flex items-center gap-3 text-white text-2xl font-headline font-bold tracking-tight">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
            <Coins className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          Token History <span className="text-zinc-500 text-sm font-normal tracking-normal ml-auto">Source: {target.type === 'user' ? (target.role || 'Personal') : 'Premise'}</span>
        </CardTitle>
        <CardDescription className="text-zinc-400 mt-2">Verified records of token additions and usage.</CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 pt-6">
        {error && logs && logs.length > 0 && (
          <Alert variant="destructive" className="mb-6 bg-red-500/10 border-red-500/20 text-red-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold uppercase tracking-tight text-xs">Sync Integrity Compromised</AlertTitle>
            <AlertDescription className="text-[10px] opacity-80">{error}</AlertDescription>
          </Alert>
        )}
        {renderContent()}
      </CardContent>
    </Card>
  );
}

export const TokenHistoryCard = React.memo(TokenHistoryCardComponent);