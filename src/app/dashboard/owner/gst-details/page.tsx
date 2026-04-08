'use client';

import * as React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GstDetailsCard } from '@/components/shared/GstDetailsCard';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDoc } from '@/supabase';
import { Premise } from '@/services/premise-service';

export default function OwnerGstDetailsPage() {
  const searchParams = useSearchParams();
  const premiseId = searchParams.get('premise_id');
  const router = useRouter();

  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  const { data: premise, isLoading } = useDoc<Premise>(docRef);

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!premiseId) return null;

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href={`/dashboard/owner?premiseId=${premiseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <GstDetailsCard
        target={{ type: 'premise', id: premiseId }}
        initialData={{
          legal_name: premise?.legal_name,
          gst_number: premise?.gst_number,
          billing_address: premise?.billing_address,
          billing_state: premise?.billing_state
        }}
        onSuccess={() => router.push(`/dashboard/owner?premiseId=${premiseId}`)}
      />
    </div>
  );
}

