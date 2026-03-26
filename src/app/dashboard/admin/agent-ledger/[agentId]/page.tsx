'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft,
  Loader2,
  BookText,
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

import { useDoc, useUser } from '@/supabase';
import { Agent } from '@/services/agent-service';
import { getAgentLedgerAction, type AgentLedgerEntry } from '@/services/agent-ledger-service';
import { recordAgentPayout } from './actions';
import { useSettings } from '@/services/settings-service';
import { useUserProfile } from '@/services/user-service';
import { useToast } from '@/hooks/use-toast';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';


const payoutSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  description: z.string().min(5, "Please provide a brief description for this payout."),
});

type PayoutFormValues = z.infer<typeof payoutSchema>;


export default function AgentLedgerPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const { user } = useUser();
  const { data: adminProfile } = useUserProfile(user?.id);
  const { toast } = useToast();

  const [isPayoutFormOpen, setIsPayoutFormOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [ledger, setLedger] = React.useState<AgentLedgerEntry[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = React.useState(true);
  const [ledgerError, setLedgerError] = React.useState<string | null>(null);

  const docRef = React.useMemo(() => {
    if (!agentId) return null;
    return { table: 'agents', id: agentId, __memo: true };
  }, [agentId]);
  const { data: agent, isLoading: isLoadingAgent } = useDoc<Agent>(docRef);

  const { data: settings, isLoading: isLoadingSettings } = useSettings();

  const fetchLedger = React.useCallback(async () => {
    if (!agentId) return;
    setIsLoadingLedger(true);
    setLedgerError(null);
    const result = await getAgentLedgerAction(agentId);
    if (result.success && result.ledger) {
      setLedger(result.ledger);
    } else {
      setLedgerError(result.error || 'Failed to load ledger history.');
    }
    setIsLoadingLedger(false);
  }, [agentId]);

  React.useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  React.useEffect(() => {
    if (ledger.length > 0 && adminProfile && agent) {
      createLogEntry({
        actorId: adminProfile.id,
        actorName: adminProfile.name,
        actorRole: 'admin',
        action: LogAction.VIEW_AGENT_LEDGER_ADMIN,
        description: `Admin "${adminProfile.name}" viewed agent ledger for "${agent.name}".`,
        context: { agentId: agent.id }
      });
    }
  }, [ledger.length, adminProfile, agent]);

  const isLoading = isLoadingAgent || isLoadingLedger || isLoadingSettings;
  const currency = settings?.currency || 'INR';

  const payoutForm = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { amount: 0, description: '' },
  });

  const handlePayoutSubmit = async (data: PayoutFormValues) => {
    if (!adminProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not identify admin user.' });
      return;
    }
    setIsSubmitting(true);
    const result = await recordAgentPayout({
      agentId,
      amount: data.amount,
      description: data.description,
      actor: { id: adminProfile.id, name: adminProfile.name }
    });

    if (result.success) {
      toast({ title: 'Payout Recorded', description: 'The agent\'s balance has been updated.' });
      setIsPayoutFormOpen(false);
      payoutForm.reset();
      fetchLedger(); // Refresh history
    } else {
      toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
    }
    setIsSubmitting(false);
  };


  const renderContent = () => {
    if (isLoadingLedger) {
      return (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (ledgerError) {
      return (
        <div className="py-10 text-center text-destructive bg-destructive/10 rounded-lg p-6">
          <AlertTriangle className="mx-auto h-10 w-10 mb-4" />
          <p className="font-semibold">Failed to load ledger history</p>
          <p className="text-sm mt-1">{ledgerError}</p>
        </div>
      )
    }

    if (!ledger || ledger.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="mb-2 font-semibold">No Transactions Found</p>
          <p className="text-sm">
            This agent has no commission or payout history yet.
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger.map(entry => {
            const isCredit = entry.type === 'credit';
            const colorClass = isCredit ? 'text-emerald-600' : 'text-destructive';
            const Icon = isCredit ? ArrowUpCircle : ArrowDownCircle;

            return (
              <TableRow key={entry.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(parseISO(entry.timestamp), 'PP p')}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{entry.description}</span>
                    {entry.context?.invoiceId && (
                      <span className="text-[10px] text-muted-foreground font-mono">Invoice: {entry.context.invoiceId}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn("text-right font-mono flex items-center justify-end gap-2", colorClass)}>
                  <Icon className="h-4 w-4" />
                  <span>{isCredit ? '+' : '-'}{entry.amount.toFixed(2)}</span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {entry.balance_after.toFixed(2)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="container py-10 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin/referrals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Agents
          </Link>
        </Button>
        <Dialog open={isPayoutFormOpen} onOpenChange={setIsPayoutFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Record Payout
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Manual Payout</DialogTitle>
              <DialogDescription>
                This will create a debit entry in the agent&apos;s ledger. Use this after you have completed an offline bank transfer.
              </DialogDescription>
            </DialogHeader>
            <Form {...payoutForm}>
              <form onSubmit={payoutForm.handleSubmit(handlePayoutSubmit)} className="space-y-4 py-4">
                <FormField control={payoutForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payout Amount ({currency})</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={payoutForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Notes</FormLabel>
                    <FormControl><Textarea placeholder="e.g., Bank Transfer for July 2024 earnings" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Payout
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAgent ? <Loader2 className='animate-spin' /> : (
              <div className="space-y-2 text-sm">
                <p className="text-lg font-bold capitalize">{agent?.name}</p>
                <p className="text-muted-foreground">{agent?.phone}</p>
                <p className="text-muted-foreground capitalize">{(agent as any)?.city}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Current Commission Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAgent ? <Loader2 className='animate-spin' /> : (
              <p className="text-4xl font-bold font-mono">
                {((agent as any)?.commission_balance ?? 0).toFixed(2)}
                <span className='text-lg font-sans text-muted-foreground ml-2'>{currency}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookText className="h-5 w-5" /> Agent Ledger
          </CardTitle>
          <CardDescription>
            A complete history of all commission credits and payouts for this
            agent.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}
