'use client';

/**
 * AAVIJA VMS — Admin: Premise Applications Panel
 * Shows pending/approved/rejected applications with one-click approve/reject.
 */

import * as React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock3,
  Building2,
  MapPin,
  Mail,
  User,
  Loader2,
  MessageSquare,
  CalendarDays,
  Shapes,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  PremiseApplication,
  approvePremiseApplication,
  rejectPremiseApplication,
} from '@/services/premise-application-actions';
import { usePremiseCategories, type PremiseCategory } from '@/services/premise-category-service';

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────

const statusConfig = {
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock3 },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
};

// ─── SINGLE APPLICATION CARD ───────────────────────────────────────────────────

function ApplicationCard({
  app,
  onApprove,
  onReject,
  isProcessing,
  categories,
  selectedCategoryId,
  onCategoryChange,
}: {
  app: PremiseApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: string | null;
  categories: PremiseCategory[];
  selectedCategoryId: string;
  onCategoryChange: (id: string, catId: string) => void;
}) {
  const StatusIcon = statusConfig[app.status].icon;
  const isThisProcessing = isProcessing === app.id;

  return (
    <div className={cn(
      'rounded-2xl border p-6 space-y-4 transition-all',
      app.status === 'pending'
        ? 'bg-black/40 border-white/5 hover:border-white/10'
        : app.status === 'approved'
        ? 'bg-emerald-500/5 border-emerald-500/10 opacity-70'
        : 'bg-red-500/5 border-red-500/10 opacity-70'
    )}>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm leading-tight">{app.premise_name}</h4>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">
              {app.city_name}{app.city_state ? `, ${app.city_state}` : ''}
            </p>
          </div>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border flex-shrink-0',
          statusConfig[app.status].color
        )}>
          <StatusIcon className="h-3 w-3" />
          {statusConfig[app.status].label}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-2.5">
        <div className="flex items-center gap-2 text-zinc-400">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
          <span className="text-[11px]">{app.premise_address}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <Mail className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
          <span className="text-[11px]">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider mr-2">Owner</span>
            {app.owner_email}
          </span>
        </div>
        {app.agent_name && (
          <div className="flex items-center gap-2 text-zinc-400">
            <User className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
            <span className="text-[11px]">
              <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider mr-2">Agent</span>
              {app.agent_name}
              {app.agent_email && <span className="text-zinc-600 ml-1.5">({app.agent_email})</span>}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-zinc-600">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-[10px] font-medium">
            Submitted {format(new Date(app.created_at), 'dd MMM yyyy, hh:mm a')}
          </span>
        </div>
      </div>

      {/* Rejection reason */}
      {app.rejection_reason && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
          <MessageSquare className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-red-300">{app.rejection_reason}</p>
        </div>
      )}

      {/* Category Selection (only for pending) */}
      {app.status === 'pending' && (
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
            <Shapes className="h-3 w-3" /> Assign Category
          </label>
          <Select
            value={selectedCategoryId}
            onValueChange={(val) => onCategoryChange(app.id, val)}
          >
            <SelectTrigger className="bg-black/40 border-white/5 text-xs h-9 rounded-xl">
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/10">
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id!} className="text-xs">
                  {cat.name} ({cat.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions (only for pending) */}
      {app.status === 'pending' && (
        <div className="flex gap-3 pt-2">
          <Button
            size="sm"
            onClick={() => onApprove(app.id)}
            disabled={!!isProcessing || !selectedCategoryId}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[9px] h-9 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40"
          >
            {isThisProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {selectedCategoryId ? 'Approve' : 'Select Category first'}</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => onReject(app.id)}
            disabled={!!isProcessing}
            variant="ghost"
            className="flex-1 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-black uppercase tracking-widest text-[9px] h-9 rounded-xl"
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

interface PremiseApplicationsPanelProps {
  applications: PremiseApplication[];
  onRefresh: () => void;
}

export function PremiseApplicationsPanel({ applications, onRefresh }: PremiseApplicationsPanelProps) {
  const { toast } = useToast();
  const { data: categories = [] } = usePremiseCategories();
  const [isProcessing, setIsProcessing] = React.useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [selectedCategories, setSelectedCategories] = React.useState<Record<string, string>>({});
  
  const [showApproved, setShowApproved] = React.useState(false);
  const [showRejected, setShowRejected] = React.useState(false);

  const pendingApps = applications.filter((a) => a.status === 'pending');
  const approvedApps = applications.filter((a) => a.status === 'approved');
  const rejectedApps = applications.filter((a) => a.status === 'rejected');

  const handleApprove = async (id: string) => {
    const categoryId = selectedCategories[id];
    if (!categoryId) {
      toast({ title: 'Category Required', description: 'Please select a premise category before approving.', variant: 'destructive' });
      return;
    }

    setIsProcessing(id);
    try {
      const result = await approvePremiseApplication(id, categoryId);
      if (!result.success) {
        toast({ title: 'Approval Failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: '✓ Premise Approved', description: 'The property has been created and the agent has been notified.' });
      onRefresh();
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    setIsProcessing(rejectTarget);
    try {
      const result = await rejectPremiseApplication(rejectTarget, rejectReason);
      if (!result.success) {
        toast({ title: 'Rejection Failed', description: result.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Application Rejected', description: 'The application has been marked as rejected.' });
      onRefresh();
    } finally {
      setIsProcessing(null);
      setRejectTarget(null);
      setRejectReason('');
    }
  };

  return (
    <>
      <div className="space-y-8">
        {/* Pending Section (Always Visible) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending Applications
              <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[9px] ml-1">
                {pendingApps.length}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingApps.length > 0 ? (
              pendingApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onApprove={handleApprove}
                  onReject={(id) => { setRejectTarget(id); setRejectReason(''); }}
                  isProcessing={isProcessing}
                  categories={categories || []}
                  selectedCategoryId={selectedCategories[app.id] || ''}
                  onCategoryChange={(appId, catId) => setSelectedCategories(prev => ({ ...prev, [appId]: catId }))}
                />
              ))
            ) : (
              <div className="col-span-full py-12 rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-600 bg-white/[0.02]">
                <CheckCircle2 className="h-8 w-8 mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">No pending applications</p>
              </div>
            )}
          </div>
        </section>

        {/* Collapsible Sections */}
        <div className="space-y-3">
          {/* Approved Section */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all">
            <button
              onClick={() => setShowApproved(!showApproved)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  showApproved ? "bg-emerald-500/20 text-emerald-500" : "bg-white/5 text-zinc-500 group-hover:text-emerald-500"
                )}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Approved Premises</span>
                  <span className="text-[9px] font-medium text-zinc-500">{approvedApps.length} previously approved properties</span>
                </div>
              </div>
              <div className={cn("transition-transform duration-200", showApproved ? "rotate-180" : "")}>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </div>
            </button>
            {showApproved && (
              <div className="p-4 pt-0 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {approvedApps.length > 0 ? (
                    approvedApps.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        onApprove={handleApprove}
                        onReject={(id) => { setRejectTarget(id); setRejectReason(''); }}
                        isProcessing={isProcessing}
                        categories={categories || []}
                        selectedCategoryId={selectedCategories[app.id] || ''}
                        onCategoryChange={(appId, catId) => setSelectedCategories(prev => ({ ...prev, [appId]: catId }))}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={ClipboardList}
                      title="No Approved Applications"
                      description="Approved premise applications will appear here."
                      className="border-0 bg-transparent py-8"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rejected Section */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all">
            <button
              onClick={() => setShowRejected(!showRejected)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  showRejected ? "bg-red-500/20 text-red-500" : "bg-white/5 text-zinc-500 group-hover:text-red-500"
                )}>
                  <XCircle className="h-4 w-4" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Rejected Applications</span>
                  <span className="text-[9px] font-medium text-zinc-500">{rejectedApps.length} rejected requests</span>
                </div>
              </div>
              <div className={cn("transition-transform duration-200", showRejected ? "rotate-180" : "")}>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </div>
            </button>
            {showRejected && (
              <div className="p-4 pt-0 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {rejectedApps.length > 0 ? (
                    rejectedApps.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        onApprove={handleApprove}
                        onReject={(id) => { setRejectTarget(id); setRejectReason(''); }}
                        isProcessing={isProcessing}
                        categories={categories || []}
                        selectedCategoryId={selectedCategories[app.id] || ''}
                        onCategoryChange={(appId, catId) => setSelectedCategories(prev => ({ ...prev, [appId]: catId }))}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={XCircle}
                      title="No Rejected Applications"
                      description="Rejected premise applications will appear here."
                      className="border-0 bg-transparent py-8"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-white">Reject Application?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-zinc-400 text-sm">
              Provide a reason for rejection (optional). This will be stored with the application.
            </AlertDialogDescription>
            <Textarea
              placeholder="e.g., Incomplete address, owner details mismatch..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-4 bg-black/40 border-white/5 text-white placeholder:text-zinc-600 rounded-xl resize-none"
              rows={3}
            />
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 pt-4">
            <AlertDialogCancel className="bg-transparent border-white/5 text-zinc-400 hover:text-white hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!!isProcessing}
              className="bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] h-10 px-8"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
