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
import { useAllUsers, UserProfile } from '@/services/user-service';
import { usePremises, Premise } from '@/services/premise-service';
import Link from 'next/link';
import { WithId } from '@/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

export default function OwnerTokensPage() {
  const {
    data: allUsers,
    isLoading: isLoadingUsers,
    error: errorUsers,
  } = useAllUsers();
  const {
    data: premises,
    isLoading: isLoadingPremises,
    error: errorPremises,
  } = usePremises();
  const [searchTerm, setSearchTerm] = React.useState('');

  const isLoading = isLoadingUsers || isLoadingPremises;
  const error = errorUsers || errorPremises;

  const userMap = React.useMemo(() => {
    if (!allUsers) return new Map<string, WithId<UserProfile>>();
    return new Map(allUsers.map((u) => [u.id, u]));
  }, [allUsers]);

  const filteredAndSortedPremises = React.useMemo(() => {
    if (!premises) return [];

    const filtered = premises.filter((p) => {
      const ownerName = userMap.get(p.owner_id)?.name.toLowerCase() || '';
      const lowerSearchTerm = searchTerm.toLowerCase();

      return (
        p.name.toLowerCase().includes(lowerSearchTerm) ||
        ownerName.includes(lowerSearchTerm) ||
        p.city.toLowerCase().includes(lowerSearchTerm)
      );
    });

    return filtered.sort((a, b) => (b.token_balance ?? 0) - (a.token_balance ?? 0));
  }, [premises, searchTerm, userMap]);

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
          <p>An error occurred while fetching data.</p>
          <p className="text-sm">{error.message}</p>
        </div>
      );
    }

    if (!premises || premises.length === 0) {
      return (
        <div className="py-10 text-center text-muted-foreground">
          <p>No premises found.</p>
        </div>
      );
    }

    return (
      <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by premise, owner, or city..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Premise</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Token Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedPremises.map((premise: WithId<Premise>) => {
              const owner = userMap.get(premise.owner_id);
              return (
                <TableRow key={premise.id}>
                  <TableCell className="font-medium capitalize">{premise.name}</TableCell>
                  <TableCell>
                    {owner ? (
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {owner.photo_url && (
                            <AvatarImage src={owner.photo_url} alt={owner.name} />
                          )}
                          <AvatarFallback>{owner.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{owner.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {owner.email}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unknown Owner</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {(premise.token_balance ?? 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredAndSortedPremises.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No premises match your search.
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
          <CardTitle>Premise Token Balances</CardTitle>
          <CardDescription>
            A list of all premises and their token balances, sorted from highest
            to lowest.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
}

