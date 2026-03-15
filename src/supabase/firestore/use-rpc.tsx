'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

export interface UseRpcResult<T> {
  data: T | null;
  isLoading: boolean;
  error: PostgrestError | Error | null;
}

/**
 * React hook to call a Supabase RPC once.
 */
export function useRpc<T = any>(
  fnName: string,
  params: any,
  deps: any[] = []
): UseRpcResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<PostgrestError | Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // We don't reset data to null here to avoid UI blinking (keepPreviousData pattern)
      setError(null);

      try {
        const supabase = createClient();
        const { data: result, error: rpcError } = await supabase.rpc(fnName, params);

        if (rpcError) {
          setError(rpcError);
        } else {
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, deps);

  return { data, isLoading, error };
}
