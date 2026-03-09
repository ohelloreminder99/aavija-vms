'use client';

import * as React from 'react';
import { useCollection, WithId } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===
export interface Rating {
  id?: string;
  visitId: string;
  visitorId: string;
  hostId: string;
  premiseId: string;
  rating: number;
  createdAt: any;
}

// === REPOSITORY FUNCTIONS (HOOKS) ===

/**
 * Hook to fetch ratings for a given list of visit IDs.
 * @param visitIds An array of visit IDs to fetch ratings for.
 * @returns A map of visitId to rating document.
 */
export function useRatingsForVisits(visitIds: string[]) {
  const query = React.useMemo(() => {
    if (visitIds.length === 0) return null;
    return { table: 'ratings', filters: [{ column: 'visitId', operator: 'in' as const, value: visitIds }], __memo: true };
  }, [visitIds]);

  const { data: ratings, ...rest } = useCollection<Rating>(query as any);

  const ratingsMap = React.useMemo(() => {
    if (!ratings) return new Map<string, WithId<Rating>>();
    return new Map(ratings.map(r => [r.visitId, r as WithId<Rating>]));
  }, [ratings]);

  return { ratingsMap, ...rest };
}

