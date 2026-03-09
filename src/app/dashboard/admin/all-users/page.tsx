'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Search, PhoneOff } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAllUsers, UserProfile, useUserProfile } from '@/services/user-service';
import Link from 'next/link';
import { WithId, useUser } from '@/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { removeUserPhoneNumber } from './actions';
import { Badge } from '@/components/ui/badge';
import { createLogEntry } from '@/services/log-service';
import { LogAction } from '@/services/log-actions';

export default function AllUsersPage() {
  const { data: users, isLoading, error } = useAllUsers();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [userToManage, setUserToManage] = React.useState<WithId<UserProfile> | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const { data: adminProfile } = useUserProfile(user?.id);

  React.useEffect(() => {
    if (users && users.length > 0 && adminProfile) {
      createLogEntry({
        actorId: adminProfile.id,
        actorName: adminProfile.name,
        actorRole: 'admin',
        action: LogAction.VIEW_ALL_USERS_ADMIN,
        description: `Admin "${adminProfile.name}" viewed the all users dashboard.`
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, adminProfile]);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone || '').includes(searchTerm)
    );
  }, [users, searchTerm]);

  const handleRemovePhoneConfirm = async () => {
    if (!userToManage) return;

    setIsSubmitting(true);
    const result = await removeUserPhoneNumber(userToManage.id);

    if (result.success) {
      toast({
        title: 'Phone Number Removed',
        description: `The phone number for ${userToManage.name} has been unlinked.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: result.error,
      });
    }

    setIsSubmitting(false);
    setUserToManage(null);
  };

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
          <p>An error occurred while fetching users.</p>
          <p className="text-sm">{error.message}</p>
        </div>
      );
    }

    if (!users || users.length === 0) {
      return (
        <div className="py-10 text-center text-muted-foreground">
          <p>No users found in the system.</p>
        </div>
      );
    }

    return (
      <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user: WithId<UserProfile>) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {user.photo_url && (
                        <AvatarImage
                          src={user.photo_url}
                          alt={user.name}
                        />
                      )}
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{user.role}</Badge></TableCell>
                <TableCell>
                  {user.phone ? (
                    <div className="flex items-center gap-2">
                      <span>{user.phone}</span>
                      {user.is_verified && <Badge variant="secondary">Verified</Badge>}
                    </div>
                  ) : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUserToManage(user)}
                    disabled={!user.phone}
                    title="Remove Phone Number"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredUsers.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No users match your search.
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
          <CardTitle>Manage All Users</CardTitle>
          <CardDescription>
            View all users in the system and perform administrative actions.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
      <AlertDialog open={!!userToManage} onOpenChange={(open) => !open && setUserToManage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the phone number <span className="font-bold">{userToManage?.phone}</span> from <span className="font-bold">{userToManage?.name}</span>&apos;s authentication profile. The user will need to re-verify if they add a number again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePhoneConfirm} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

