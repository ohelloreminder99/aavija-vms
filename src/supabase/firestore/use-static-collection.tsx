'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseQueryRef, WithId } from './use-collection';

export interface UseStaticCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: PostgrestError | Error | null;
}

/**
 * React hook to fetch a Supabase table/query once.
 * This does NOT subscribe to real-time updates.
 */
export function useStaticCollection<T = any>(
  memoizedQuery: SupabaseQueryRef | null | undefined,
): UseStaticCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<PostgrestError | Error | null>(null);

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!memoizedQuery.__memo) {
      console.warn('useStaticCollection: memoizedQuery was not properly memoized', memoizedQuery);
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();

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

      try {
        const { data: rows, error } = await q;

        if (error) {
          setError(error);
          setData(null);
        } else {
          setData(rows as any);
        }
      } catch (err: any) {
        setError(err);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [memoizedQuery]);

  return { data, isLoading, error };
}
