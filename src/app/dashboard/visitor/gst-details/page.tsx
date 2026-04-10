'use client';

import * as React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GstDetailsCard } from '@/components/shared/GstDetailsCard';
import { useUser } from '@/supabase';
import { useUserProfile } from '@/services/user-service';
import { useRouter } from 'next/navigation';

export default function VisitorGstDetailsPage() {
  const { user } = useUser();
  const { data: userProfile, isLoading } = useUserProfile(user?.id);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user?.id) return null;

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button asChild variant="outline">
          <Link href="/dashboard/visitor">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <GstDetailsCard
        target={{ type: 'user', id: user.id }}
        initialData={{
          legalName: userProfile?.legal_name,
          gstNumber: userProfile?.gst_number,
          billingAddress: userProfile?.billing_address,
          billingState: userProfile?.billing_state
        }}
        onSuccess={() => router.push('/dashboard/visitor')}
      />
    </div>
  );
}

