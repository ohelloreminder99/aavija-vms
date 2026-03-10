'use client';

import { useStaticCollection, useDoc } from '@/supabase';
import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

export type HostAvailability = 'available' | 'busy' | 'do-not-disturb';

export interface StaffMember {
  uid: string;
  name: string;
  email: string;
  role: 'host' | 'gatekeeper';
  is_active: boolean;
  photo_url: string;
  identity?: string;
  availability?: HostAvailability;
}

// Matches the Premise entity in docs/backend.json
export interface Premise {
  id: string;
  name: string;
  address: string;
  city: string;
  cityId?: string; // New field for robust location matching
  city_state?: string;
  is_active: boolean;
  owner_id: string;
  ownerName?: string;
  token_balance: number;
  agent_id?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  host_count?: number;
  gatekeeper_count?: number;
  staff?: StaffMember[];
  // GST Details for Invoicing
  gstNumber?: string;
  billingAddress?: string;
  legalName?: string;
  billingState?: string;
}

// === REPOSITORY FUNCTIONS (HOOKS) ===

/**
 * Hook to fetch all premises once.
 * @returns The same result as useStaticCollection: { data, isLoading, error }
 */
export function usePremises() {
  const query = React.useMemo(() => {
    return { table: 'premises', __memo: true };
  }, []);

  return useStaticCollection<Premise>(query as any);
}

/**
 * Hook to fetch a single premise by its ID.
 * @param premiseId The ID of the premise to fetch.
 * @returns The same result as useDoc: { data, isLoading, error }
 */
export function usePremiseById(premiseId: string | undefined) {
  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  return useDoc<Premise>(docRef);
}


/**
 * Updates an existing premise document.
 * @param _db Parameter ignored
 * @param id The ID of the premise to update.
 * @param data The partial premise data to update.
 */
export async function updatePremise(_db: any, id: string, data: Partial<Premise>) {
  const supabase = await createClient();
  const { error } = await supabase.from('premises').update(data).eq('id', id);
  if (error) throw error;
}
