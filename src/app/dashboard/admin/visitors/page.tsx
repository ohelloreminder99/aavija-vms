
'use client';

import { ArrowLeft, Loader2, Search, Eye } from 'lucide-react';
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
  const {
    data: visitors,
    isLoading: isLoadingVisitors,
    error,
  } = useUsersByRole('visitor');
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
      (v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [visitors, searchTerm]);

  const premiseMap = React.useMemo(() => {
    if (!premises) return new Map<string, string>();
    return new Map(premises.map((p) => [p.id, p.name]));
  }, [premises]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Syncing Visitor Registry...</p>
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
          <Search className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">No Visitors Found</p>
          <p className="text-zinc-700 text-[9px] mt-2 font-medium uppercase tracking-widest">No visitors matching your search were found.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="relative group max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search name or email..."
            className="pl-11 bg-black/40 border-white/5 text-white h-12 rounded-2xl placeholder:text-zinc-800 focus:border-primary/30 transition-all focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-14">Visitor Profile</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-14">Email Address</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-14">Phone Number</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-500 h-14">Token Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.map((visitor: WithId<UserProfile>) => (
                <TableRow key={visitor.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setImageUrlToView(visitor.photo_url || null)}
                        disabled={!visitor.photo_url}
                        className="relative group/avatar"
                      >
                        <Avatar className="h-12 w-12 border border-white/5 group-hover/avatar:border-primary/50 transition-all">
                          {visitor.photo_url && <AvatarImage src={visitor.photo_url} alt={visitor.name} className="object-cover" />}
                          <AvatarFallback className="bg-zinc-100 text-zinc-500">{visitor.name.charAt(0)}</AvatarFallback>
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
                        <span className="text-[9px] text-zinc-600 font-mono tracking-tighter uppercase mt-0.5">
                          ID: {visitor.id.split('-')[0]}...
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-xs font-medium">{visitor.email}</TableCell>
                  <TableCell className="text-zinc-400 text-xs font-mono">{visitor.phone || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] tabular-nums">
                        {(visitor.token_balance_visitor ?? 0).toLocaleString()}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700">Tokens</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredVisitors.length === 0 && (
            <div className="py-20 text-center bg-zinc-50/50">
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
          <Button asChild variant="ghost" className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 -ml-4 px-4 h-10 text-[10px] font-black uppercase tracking-widest transition-all">
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
              <h1 className="text-4xl font-headline font-bold text-zinc-900 tracking-tighter">
                Visitor <span className="text-primary/80">Registry</span>
              </h1>
            </div>
            <p className="text-zinc-500 text-[11px] font-medium uppercase tracking-[0.2em] ml-1">
              View and manage all registered visitors and their account status.
            </p>
          </div>
        </div>
      </div>

      <Card className="glass-card border-zinc-200 shadow-xl relative overflow-hidden bg-white/40">
        <div className="absolute inset-0 mesh-porcelain opacity-20 pointer-events-none" />
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
        <DialogContent className="max-w-xl bg-white border-zinc-200 shadow-2xl p-0 overflow-hidden">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/30">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-zinc-900 tracking-tight">Visitor <span className="text-primary/80">Photo</span></DialogTitle>
            </DialogHeader>
          </div>
          {imageUrlToView && (
            <div className="relative aspect-square w-full bg-black/40 p-8 flex items-center justify-center">
              <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                <Image
                  src={imageUrlToView}
                  alt="Visitor identity"
                  fill
                  className="object-contain"
                />
                <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl" />
              </div>
            </div>
          )}
          <div className="p-6 border-t border-zinc-100 bg-zinc-50/30 flex justify-end">
            <Button onClick={() => setImageUrlToView(null)} className="h-10 px-8 bg-zinc-900 border border-zinc-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

