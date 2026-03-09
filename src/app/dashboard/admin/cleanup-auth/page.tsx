'use client';

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, UserX, Trash2 } from 'lucide-react';
import { getOrphanedAuthUsers, deleteAuthUser } from './actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// Type for the serializable user data returned from the server action
type OrphanedUser = {
  uid: string;
  email?: string;
  creationTime: string;
  lastSignInTime: string;
};

export default function CleanupAuthPage() {
  const [isFinding, startFindingTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [users, setUsers] = useState<OrphanedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<OrphanedUser | null>(null);
  const { toast } = useToast();

  const handleFetchClick = () => {
    // Reset state before fetching
    setUsers(null);
    setError(null);

    startFindingTransition(async () => {
      const result = await getOrphanedAuthUsers();
      if (result.success && result.users) {
        setUsers(result.users);
        toast({
          title: 'Scan Complete',
          description: `Found ${result.users.length} orphaned account(s).`,
        })
      } else {
        setError(result.error || 'An unknown error occurred.');
        toast({
          variant: 'destructive',
          title: 'Scan Failed',
          description: result.error || 'Could not fetch orphaned accounts.'
        })
        setUsers(null);
      }
    });
  };

  const openDeleteDialog = (user: OrphanedUser) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!userToDelete) return;

    startDeleteTransition(async () => {
      const result = await deleteAuthUser(userToDelete.uid);
      if (result.success) {
        toast({
          title: 'User Deleted',
          description: `The user account for ${userToDelete.email || userToDelete.uid} has been permanently deleted.`,
        });
        // Remove user from local state to update UI
        setUsers((prevUsers) => prevUsers?.filter((u) => u.uid !== userToDelete.uid) || null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: result.error,
        });
      }
      setIsDeleteAlertOpen(false);
      setUserToDelete(null);
    });
  };

  const renderContent = () => {
    if (isFinding) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Scanning for orphaned accounts...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-destructive py-10">
          <p className='font-semibold'>An error occurred:</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (users === null) {
      return (
        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
          <p>Click the "Find Orphaned Accounts" button to scan for users</p>
          <p className='text-sm'>who exist in Authentication but not in the database.</p>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="py-10 text-center text-emerald-600 border-2 border-dashed rounded-lg border-emerald-500/50 bg-emerald-500/5">
          <p className="font-semibold">All Clean!</p>
          <p className='text-sm'>No orphaned authentication accounts were found.</p>
        </div>
      );
    }

    return (
      <>
        <p className="mb-4 text-sm text-muted-foreground">
          Found {users.length} orphaned account(s). These should likely be
          removed.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Created On</TableHead>
              <TableHead>Last Signed In</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.uid}>
                <TableCell className="font-medium">
                  {user.email || 'N/A'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {user.uid}
                </TableCell>
                <TableCell>
                  {format(new Date(user.creationTime), 'PPP')}
                </TableCell>
                <TableCell>
                  {format(new Date(user.lastSignInTime), 'PPP')}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(user)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/dashboard/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <Button onClick={handleFetchClick} disabled={isFinding}>
          {isFinding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserX className="mr-2 h-4 w-4" />
          )}
          Find Orphaned Accounts
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Authentication Cleanup</CardTitle>
          <CardDescription>
            Find and delete user accounts that exist in Supabase Authentication but do not
            have a corresponding profile document in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the auth account
              for <span className="font-medium">{userToDelete?.email || userToDelete?.uid}</span>. This should only be
              done if you are certain this user has no associated data in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
