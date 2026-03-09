'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TokenHistoryCard } from '@/components/shared/TokenHistoryCard';
import { useUser } from '@/supabase';

export default function VisitorTokenHistoryPage() {
  const { user } = useUser();

  if (!user?.id) {
    return (
      <div className="container py-10 text-center text-destructive">
        <p>You must be logged in to view your token history.</p>
        <Button asChild variant="link">
          <Link href="/login">Return to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/visitor">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Visitor Dashboard
          </Link>
        </Button>
      </div>
      <TokenHistoryCard target={{ type: 'user', id: user.id, role: 'visitor' }} />
    </div>
  );
}

