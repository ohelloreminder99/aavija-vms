
'use client';

import { ArrowLeft, Loader2, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useUsersByRole, UserProfile, useUserProfile } from '@/services/user-service';
import { useUser, WithId } from '@/supabase';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import * as React from 'react';
import { usePremises } from '@/services/premise-service';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

const VisitorHistoryDialog = React.lazy(() => import('./components/VisitorHistoryDialog'));

export default function VisitorsPage() {
  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const {
    data: visitors,
    isLoading: isLoadingVisitors,
    hasMore,
    error,
  } = useUsersByRole('visitor', { page, pageSize });
  const { data: premises, isLoading: isLoadingPremises } = usePremises();
  const [selectedVisitor, setSelectedVisitor] =
    React.useState<WithId<UserProfile> | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [imageUrlToView, setImageUrlToView] = React.useState<string | null>(null);

  const { user } = useUser();
  const { data: adminProfile } = useUserProfile(user?.id);

  const isLoading = isLoadingVisitors || isLoadingPremises;

  const filteredVisitors = React.useMemo(() => {
    if (!visitors) return [];
    return visitors.filter(
      (v: WithId<UserProfile>) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.email && v.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [visitors, searchTerm]);

  const premiseMap = React.useMemo(() => {
    if (!premises) return new Map<string, string>();
    return new Map<string, string>(premises.map((p: any) => [p.id, p.name]));
  }, [premises]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Syncing Visitor Registry...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-20 px-6 border border-red-500/20 bg-red-500/5 rounded-2xl">
          <p className="text-red-400 font-bold mb-2">Connection Error</p>
          <p className="text-xs text-red-500/60 font-medium uppercase tracking-wider">{error.message}</p>
        </div>
      );
    }

    if (!visitors || visitors.length === 0) {
      return (
        <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-3xl bg-black/20">
          <Search className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.4em]">No Visitors Found</p>
          <p className="text-zinc-400 text-[9px] mt-2 font-medium uppercase tracking-widest">No visitors matching your search were found.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative group max-w-md flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search name or email..."
              className="pl-11 bg-white/5 border-white/10 text-white h-12 rounded-2xl placeholder:text-zinc-400 focus:border-primary/30 transition-all focus:ring-primary/20 font-semibold"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 self-end md:self-auto shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 min-w-[80px] text-center">
              Sector {page + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || isLoading}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-xl mt-4">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14 pl-6">Visitor Profile</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14">Email Address</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14">Phone Number</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 h-14 pr-6">Token Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.map((visitor: WithId<UserProfile>) => (
                <TableRow key={visitor.id} className="border-white/10 hover:bg-white/5 transition-colors group">
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setImageUrlToView(visitor.photo_url || null)}
                        disabled={!visitor.photo_url}
                        className="relative group/avatar"
                      >
                        <Avatar className="h-12 w-12 border border-white/10 group-hover/avatar:border-primary/50 transition-all shadow-sm">
                          {visitor.photo_url && <AvatarImage src={visitor.photo_url} alt={visitor.name} className="object-cover" />}
                          <AvatarFallback className="bg-white/10 text-zinc-400 font-bold">{visitor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {visitor.photo_url && (
                          <div className="absolute inset-0 bg-primary/20 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </button>
                      <div className="flex flex-col">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-sm font-bold text-white hover:text-primary hover:no-underline transition-colors justify-start"
                          onClick={() => setSelectedVisitor(visitor)}
                        >
                          {visitor.name}
                        </Button>
                        <span className="text-[9px] text-zinc-400 font-black tracking-tighter uppercase mt-0.5">
                          ID: {visitor.id.split('-')[0]}...
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs font-semibold">{visitor.email}</TableCell>
                  <TableCell className="text-zinc-400 text-xs font-mono font-bold">{visitor.phone || '—'}</TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] tabular-nums">
                        {(visitor.token_balance_visitor ?? 0).toLocaleString()}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Tokens</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredVisitors.length === 0 && (
            <div className="py-20 text-center bg-[#010a05]/95 backdrop-blur-3xl/[0.02] rounded-2xl border border-white/5">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No Match Found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/10 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
            <Link href="/dashboard/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-headline font-bold text-white tracking-tighter">
                Visitor <span className="text-primary/80">Registry</span>
              </h1>
            </div>
            <p className="text-zinc-400 text-[11px] font-semibold uppercase tracking-[0.2em] ml-1">
              View and manage all registered visitors and their account status.
            </p>
          </div>
        </div>
      </div>

      <Card className="glass-card border-white/10 shadow-xl relative overflow-hidden bg-white/5">
        <div className="absolute inset-0 mesh-obsidian opacity-20 pointer-events-none" />
        <CardContent className="relative z-10 p-6 sm:p-8">
          {renderContent()}
        </CardContent>
      </Card>

      {selectedVisitor && (
        <React.Suspense fallback={<div />}>
          <VisitorHistoryDialog
            visitor={selectedVisitor}
            adminProfile={adminProfile}
            premiseMap={premiseMap}
            open={!!selectedVisitor}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedVisitor(null);
              }
            }}
          />
        </React.Suspense>
      )}

      <Dialog open={!!imageUrlToView} onOpenChange={() => setImageUrlToView(null)}>
        <DialogContent className="max-w-xl bg-[#010a05]/95 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight">Visitor <span className="text-primary/80">Photo</span></DialogTitle>
            </DialogHeader>
          </div>
          {imageUrlToView && (
            <div className="relative aspect-square w-full bg-white/5 p-8 flex items-center justify-center">
              <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <Image
                  src={imageUrlToView}
                  alt="Visitor identity"
                  fill
                  className="object-contain"
                />
                <div className="absolute inset-0 pointer-events-none border border-white/10/20 rounded-2xl" />
              </div>
            </div>
          )}
          <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end">
            <Button onClick={() => setImageUrlToView(null)} className="h-10 px-8 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

