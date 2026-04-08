'use client';

import * as React from 'react';
import {
  ArrowLeft,
  BookText,
  Coins,
  Edit,
  FileText,
  KeyRound,
  Loader2,
  LogIn,
  Megaphone,
  Star,
  Trash2,
  UserPlus,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getAdminLogs,
  SerializableLog,
} from './actions';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LogAction } from '@/services/log-actions';
import { cn } from '@/lib/utils';

const actionIconMap: Record<string, React.ElementType> = {
  [LogAction.USER_SIGNUP]: UserPlus,
  [LogAction.USER_LOGIN]: LogIn,
  [LogAction.PASSWORD_CHANGED]: KeyRound,
  [LogAction.CREATE_ANNOUNCEMENT]: Megaphone,
  [LogAction.UPDATE_ANNOUNCEMENT]: Edit,
  [LogAction.DELETE_ANNOUNCEMENT]: Trash2,
  [LogAction.UPDATE_TOKEN_SETTINGS]: FileText,
  [LogAction.UPDATE_HISTORY_SETTINGS]: FileText,
  [LogAction.GATEKEEPER_CREATED]: UserPlus,
  [LogAction.GATEKEEPER_DELETED]: UserX,
  [LogAction.HOST_CREATED]: UserPlus,
  [LogAction.HOST_DELETED]: UserX,
  [LogAction.VISITOR_RATED]: Star,
  [LogAction.TOKEN_PURCHASE]: Coins,
};


const availableRoles = ['all', 'admin', 'owner', 'staff', 'gatekeeper', 'visitor', 'host'];
const availableActions = ['all', ...Object.values(LogAction)];


export default function LogsPage() {
  const [logs, setLogs] = React.useState<SerializableLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [roleFilter, setRoleFilter] = React.useState('all');
  const [actionFilter, setActionFilter] = React.useState('all');

  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    if (role !== 'all') {
      setActionFilter('all');
    }
  }

  const handleActionChange = (action: string) => {
    setActionFilter(action);
    if (action !== 'all') {
      setRoleFilter('all');
    }
  }

  React.useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { logs: newLogs, error: fetchError } = await getAdminLogs({
          role: roleFilter,
          action: actionFilter,
        });
        if (fetchError) {
          throw new Error(fetchError);
        }
        setLogs(newLogs || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [roleFilter, actionFilter]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Decrypting Ledger...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-20 px-6 border border-red-500/20 bg-red-500/5 rounded-2xl">
          <p className="text-red-400 font-bold mb-2">Interface Malfunction</p>
          <p className="text-xs text-red-500/60 font-medium uppercase tracking-wider">{error}</p>
        </div>
      );
    }

    if (logs.length === 0) {
      return (
        <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-3xl bg-black/20">
          <BookText className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.4em]">No Recorded Anomalies</p>
          <p className="text-zinc-400 text-[9px] mt-2 font-medium uppercase tracking-widest">Adjust filters to scan different registry clusters.</p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {logs.map((log) => {
          const Icon = actionIconMap[log.action] || BookText;
          const timestamp = new Date(log.timestamp);

          return (
            <div key={log.id} className="group relative flex items-center gap-6 p-5 rounded-2xl transition-all hover:bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-transparent hover:border-white/5">
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-black border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                  <Icon className="h-5 w-5" />
                </div>
                {/* Visual pulse for important events */}
                {(log.action.includes('DELETE') || log.action.includes('PURGE')) && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500/20 animate-ping" />
                )}
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white/5 border-white/10 text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-colors">
                    {log.action.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-zinc-300">•</span>
                  <Badge className={cn(
                    "text-[9px] font-black uppercase tracking-[0.15em] px-2",
                    log.actor_role === 'admin' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      log.actor_role === 'owner' ? "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20" :
                        "bg-zinc-800 text-zinc-400"
                  )}>
                    {log.actor_role}
                  </Badge>
                  <div className="flex-1" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                          {formatDistanceToNow(timestamp, { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black border-white/10 text-white text-[10px] font-mono">
                        {timestamp.toLocaleString()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-zinc-300 font-medium tracking-tight group-hover:text-white transition-colors truncate">
                  {log.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retreat to Command
            </Link>
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <BookText className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-headline font-bold text-white tracking-tighter">
                Chronicle <span className="text-primary/80">Oversight</span>
              </h1>
            </div>
            <p className="text-zinc-400 text-[11px] font-medium uppercase tracking-[0.2em] ml-1">
              Deep ledger of global structural shifts and operative behavior.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#010a05]/95 backdrop-blur-3xl/[0.02] border border-white/5 p-2 rounded-2xl backdrop-blur-sm">
          <Select value={roleFilter} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-[160px] bg-black/40 border-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:border-white/10 hover:text-white transition-all">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white shadow-2xl">
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role} className="text-[10px] font-black uppercase tracking-widest focus:bg-primary focus:text-white py-3">
                  {role === 'all' ? 'Universal Roles' : role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={handleActionChange}>
            <SelectTrigger className="w-[180px] bg-black/40 border-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:border-white/10 hover:text-white transition-all">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="bg-black border-white/10 text-white shadow-2xl max-h-[400px]">
              {availableActions.map((action) => (
                <SelectItem key={action} value={action} className="text-[10px] font-black uppercase tracking-widest focus:bg-primary focus:text-white py-3">
                  {action === 'all' ? 'All Protocols' : action.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="glass-card border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden bg-black/40">
        <div className="absolute inset-0 mesh-blue opacity-5 pointer-events-none" />
        <CardContent className="relative z-10 p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
              Registry <span className="text-zinc-300">Cluster 01</span>
            </span>
            <div className="h-px flex-1 mx-6 bg-gradient-to-r from-white/0 via-white/5 to-white/0" />
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-tighter">
              Aavija-Main.Ledger.v2
            </span>
          </div>
          {renderContent()}
        </CardContent>
      </Card>

      <div className="flex justify-center pt-8">
        <div className="px-6 py-3 rounded-full bg-[#010a05]/95 backdrop-blur-3xl/[0.01] border border-white/5 backdrop-blur-xl">
          <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-[0.5em] leading-none">
            End of Current <span className="text-zinc-300">Temporal Thread</span>
          </p>
        </div>
      </div>
    </div>
  );
}
