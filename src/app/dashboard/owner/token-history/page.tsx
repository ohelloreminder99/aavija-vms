'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TokenHistoryCard } from '@/components/shared/TokenHistoryCard';

export default function OwnerTokenHistoryPage() {
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premise_id');

  if (!premiseId) {
    return (
      <div className="container py-10 text-center text-destructive">
        <p>Premise ID is missing. Cannot load token history.</p>
        <Button asChild variant="link">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto">
      <div className="mb-4">
        <Button asChild variant="outline">
          <Link href={`/dashboard/owner?premiseId=${premiseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Owner Dashboard
          </Link>
        </Button>
      </div>
      <TokenHistoryCard target={{ type: 'premise', id: premiseId }} />
    </div>
  );
}
