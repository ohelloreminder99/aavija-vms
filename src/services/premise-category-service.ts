'use client';

import { useCollection } from '@/supabase';
import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===
export interface PremiseCategory {
  id?: string;
  name: string;
  type: 'industrial' | 'residential';
  deduction_rate_visitor: number;
  deduction_rate_premise: number;
  pdf_export_cost: number;
  csv_export_cost: number;
}

// === REPOSITORY FUNCTIONS (HOOKS) ===

/**
 * Hook to fetch all premise categories once, ordered by name.
 * This is optimized to use a static fetch as categories don't change often.
 * @returns The same result as useStaticCollection: { data, isLoading, error }
 */
export function usePremiseCategories() {
  const query = React.useMemo(() => {
    return { table: 'premise_categories', orderBy: { column: 'name', ascending: true }, __memo: true };
  }, []);

  return useCollection<PremiseCategory>(query as any);
}

