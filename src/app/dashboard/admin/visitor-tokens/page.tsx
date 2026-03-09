'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
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
import { useUsersByRole, UserProfile } from '@/services/user-service';
import Link from 'next/link';
import { WithId } from '@/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

export default function VisitorTokensPage() {
  const { data: visitors, isLoading, error } = useUsersByRole('visitor');
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredAndSortedVisitors = React.useMemo(() => {
    if (!visitors) return [];

    const filtered = visitors.filter(
      (v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => (b.token_balance_visitor ?? 0) - (a.token_balance_visitor ?? 0));
  }, [visitors, searchTerm]);

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
          <p>No visitors found.</p>
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
              <TableHead>Visitor</TableHead>
              <TableHead className="text-right">Token Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedVisitors.map((visitor: WithId<UserProfile>) => (
              <TableRow key={visitor.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {visitor.photo_url && (
                        <AvatarImage
                          src={visitor.photo_url}
                          alt={visitor.name}
                        />
                      )}
                      <AvatarFallback>{visitor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{visitor.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {visitor.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(visitor.token_balance_visitor ?? 0).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredAndSortedVisitors.length === 0 && (
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
          <CardTitle>Visitor Token Balances</CardTitle>
          <CardDescription>
            A list of all visitors and their token balances, sorted from
            highest to lowest.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}

