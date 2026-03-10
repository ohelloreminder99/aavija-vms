'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';
import { WithId } from './use-collection';

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: PostgrestError | Error | null;
}

export interface SupabaseDocRef {
  table: string;
  id: string;
  __memo?: boolean;
}

/**
 * React hook to subscribe to a single Supabase row in real-time.
 * Mimics the old `useDoc` for Firestore.
 */
export function useDoc<T = Record<string, any>>(
  memoizedDocRef: SupabaseDocRef | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | Error | null>(null);
  // Stable per component instance, but unique across instances.
  // Do NOT put this inside the useEffect — that would regenerate on every re-render.
  // Do NOT use a deterministic key — two components on the same table+id would conflict.
  const channelIdRef = useRef(`doc:${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!memoizedDocRef.__memo) {
      console.warn('useDoc: memoizedDocRef was not properly memoized', memoizedDocRef);
    }

    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    let isMounted = true;

    // Initial fetch
    const fetchDoc = async () => {
      try {
        const { data: row, error } = await supabase
          .from(memoizedDocRef.table)
          .select('*')
          .eq('id', memoizedDocRef.id)
          .single();

        if (!isMounted) return;

        if (error) {
          if (error.code === 'PGRST116') {
            // row not found
            setData(null);
          } else {
            setError(error);
            setData(null);
          }
        } else if (row) {
          setData(row as WithId<T>);
        } else {
          setData(null);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error('An unknown error occurred.'));
        setData(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDoc();

    // Subscribe to real-time changes
    // Stable per-mount channel ID (useRef ensures it doesn't change on re-renders)
    const channelId = channelIdRef.current;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: memoizedDocRef.table,
          filter: `id=eq.${memoizedDocRef.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'DELETE') {
            setData(null);
          } else {
            setData(payload.new as WithId<T>);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error("Realtime subscription error:", err)
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [memoizedDocRef]);

  return { data, isLoading, error };
}
