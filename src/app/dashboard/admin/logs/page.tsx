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

const LogItem = ({ log }: { log: SerializableLog }) => {
  const Icon = actionIconMap[log.action] || BookText;
  const timestamp = new Date(log.timestamp);

  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm text-foreground">{log.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{timestamp.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span>•</span>
          <Badge variant="outline" className="font-mono">
            {log.action}
          </Badge>
          <span>•</span>
          <Badge variant="secondary" className="capitalize">
            {log.actorRole}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default function LogsPage() {
  const [logs, setLogs] = React.useState<SerializableLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [roleFilter, setRoleFilter] = React.useState('all');
  const [actionFilter, setActionFilter] = React.useState('all');

  const handleRoleChange = (role: string) => {
    setRoleFilter(role);
    if (role !== 'all') {
      setActionFilter('all'); // Reset action filter if a role is selected
    }
  }

  const handleActionChange = (action: string) => {
    setActionFilter(action);
    if (action !== 'all') {
      setRoleFilter('all'); // Reset role filter if an action is selected
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
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 py-10">
          <p>An error occurred while fetching logs.</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (logs.length === 0) {
      return (
        <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p>No log entries found for the selected filters.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {logs.map((log) => <LogItem key={log.id} log={log} />)}
      </div>
    );
  };

  return (
    <div className="container py-10">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            An audit trail of all significant actions performed in the
            system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select value={roleFilter} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role..." />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role === 'all' ? 'All Roles' : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={handleActionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action..." />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action === 'all' ? 'All Actions' : action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}
