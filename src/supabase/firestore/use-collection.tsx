'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: PostgrestError | Error | null;
}

export interface SupabaseFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'is' | 'in' | 'contains' | 'containedBy';
  value: any;
}

export interface SupabaseOrder {
  column: string;
  ascending?: boolean;
}

export interface SupabaseQueryRef {
  table: string;
  filters?: SupabaseFilter[];
  orderBy?: SupabaseOrder;
  limit?: number;
  __memo?: boolean;
}

/**
 * React hook to subscribe to a Supabase table/query in real-time.
 * Mimics the old `useCollection` for Firestore.
 */
export function useCollection<T = Record<string, any>>(
  memoizedQuery: SupabaseQueryRef | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Stable per component instance, unique across instances — prevents both
  // 'too many channels' (from Math.random on re-render) and
  // 'mismatch between server and client bindings' (from shared deterministic IDs).
  const channelIdRef = useRef(`col:${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!memoizedQuery.__memo) {
      console.warn('useCollection: memoizedQuery was not properly memoized', memoizedQuery);
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    let isMounted = true;

    const buildQuery = () => {
      let q = supabase.from(memoizedQuery.table).select('*');

      if (memoizedQuery.filters) {
        memoizedQuery.filters.forEach(f => {
          switch (f.operator) {
            case 'eq': q = q.eq(f.column, f.value); break;
            case 'neq': q = q.neq(f.column, f.value); break;
            case 'gt': q = q.gt(f.column, f.value); break;
            case 'gte': q = q.gte(f.column, f.value); break;
            case 'lt': q = q.lt(f.column, f.value); break;
            case 'lte': q = q.lte(f.column, f.value); break;
            case 'like': q = q.like(f.column, f.value); break;
            case 'ilike': q = q.ilike(f.column, f.value); break;
            case 'is': q = q.is(f.column, f.value); break;
            case 'in': q = q.in(f.column, f.value); break;
            case 'contains': q = q.contains(f.column, f.value); break;
            case 'containedBy': q = q.containedBy(f.column, f.value); break;
          }
        });
      }

      if (memoizedQuery.orderBy) {
        q = q.order(memoizedQuery.orderBy.column, { ascending: memoizedQuery.orderBy.ascending ?? true });
      }

      if (memoizedQuery.limit) {
        q = q.limit(memoizedQuery.limit);
      }

      return q;
    };

    // Initial fetch
    const fetchCollection = async () => {
      try {
        const { data: rows, error } = await buildQuery();

        if (!isMounted) return;

        if (error) {
          setError(error);
          setData(null);
        } else {
          setData(rows as ResultItemType[]);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error('An unknown error occurred during fetch.'));
        setData(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCollection();

    // To implement perfect realtime for complex queries requires manual state management 
    // of the array (handling INSERT, UPDATE, DELETE). 
    // For simplicity, we refetch the whole query when a change happens on the table.

    // Choose the best equality filter for realtime subscription (prioritizing premise_id or visitor_id)
    let realtimeFilter = undefined;
    if (memoizedQuery.filters && memoizedQuery.filters.length > 0) {
      // Look for premise_id equality first
      const premiseFilter = memoizedQuery.filters.find(f => f.column === 'premise_id' && f.operator === 'eq');
      if (premiseFilter) {
        realtimeFilter = `${premiseFilter.column}=eq.${premiseFilter.value}`;
      } else {
        // Look for visitor_id equality second
        const visitorFilter = memoizedQuery.filters.find(f => f.column === 'visitor_id' && f.operator === 'eq');
        if (visitorFilter) {
          realtimeFilter = `${visitorFilter.column}=eq.${visitorFilter.value}`;
        } else {
          // Default to the first equality filter if available
          const firstEq = memoizedQuery.filters.find(f => f.operator === 'eq');
          if (firstEq) {
            realtimeFilter = `${firstEq.column}=eq.${firstEq.value}`;
          }
        }
      }
    }

    // Stable per-mount channel ID (unique per instance, stable across re-renders)
    const channelId = channelIdRef.current;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: memoizedQuery.table,
          ...(realtimeFilter ? { filter: realtimeFilter } : {})
        },
        () => {
          // Refetch data on any change, but debounce it to prevent freeze/race conditions
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            if (isMounted) fetchCollection();
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [memoizedQuery]);

  return { data, isLoading, error };
}
