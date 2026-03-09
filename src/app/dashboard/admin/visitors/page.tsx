
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
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 py-10">
          <p>An error occurred while fetching visitors.</p>
          <p className="text-sm">{error.message}</p>
        </div>
      );
    }

    if (!visitors || visitors.length === 0) {
      return (
        <div className="py-10 text-center text-muted-foreground">
          <p>No Visitor found.</p>
        </div>
      );
    }

    return (
      <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Token Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisitors.map((visitor: WithId<UserProfile>) => (
              <TableRow key={visitor.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setImageUrlToView(visitor.photo_url || null)} disabled={!visitor.photo_url} title="View photo">
                      <Avatar>
                        {visitor.photo_url && (
                          <AvatarImage
                            src={visitor.photo_url}
                            alt={visitor.name}
                          />
                        )}
                        <AvatarFallback>
                          {visitor.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => setSelectedVisitor(visitor)}
                      title="View visit history"
                    >
                      <div className="flex flex-col items-start">
                        <span>{visitor.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {visitor.id}
                        </span>
                      </div>
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{visitor.email}</TableCell>
                <TableCell>{visitor.phone || 'N/A'}</TableCell>
                <TableCell className="text-right font-mono">
                  {(visitor.token_balance_visitor ?? 0).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredVisitors.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No visitors match your search.
          </p>
        )}
      </>
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
          <CardTitle>Total Visitors</CardTitle>
          <CardDescription>
            A list of all users with the 'visitor' role. Click a name to view their visit history or click their photo to enlarge it.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Visitor Photo</DialogTitle>
          </DialogHeader>
          {imageUrlToView && (
            <div className="relative aspect-square w-full">
              <Image
                src={imageUrlToView}
                alt="Visitor photo"
                fill
                className="object-contain rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

