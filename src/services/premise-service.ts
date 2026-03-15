'use client';

import { useStaticCollection, useDoc, useRpc } from '@/supabase';
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
  gate_id?: string; // New: linked gate
}

export interface PremiseGate {
  id: string;
  premise_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export interface PremiseMember {
  id: string;
  premise_id: string;
  user_id: string;
  role: 'host' | 'gatekeeper';
  identity: string;
  gate_id?: string;
  is_active: boolean;
  user?: {
    name: string;
    email: string;
    photo_url: string;
  };
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
  staff?: StaffMember[]; // Deprecated: use premise_members table
  host_count?: number;
  gatekeeper_count?: number;
  gate_count?: number;
  // GST Details for Invoicing
  gstNumber?: string;
  billingAddress?: string;
  legalName?: string;
  billingState?: string;
  require_host_verification?: boolean;
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

/**
 * Hook to fetch gates for a specific premise.
 */
export function usePremiseGates(premiseId: string | undefined) {
  const query = React.useMemo(() => {
    if (!premiseId) return null;
    return {
      table: 'premise_gates',
      filters: [{ column: 'premise_id', operator: 'eq' as const, value: premiseId }],
      orderBy: { column: 'name', ascending: true },
      __memo: true
    };
  }, [premiseId]);

  return useStaticCollection<PremiseGate>(query as any);
}

/**
 * Hook to fetch members (Hosts/Gatekeepers) for a specific premise with pagination.
 */
export function usePremiseMembers(
  premiseId: string | undefined, 
  role?: 'host' | 'gatekeeper',
  options?: { pageSize?: number; page?: number; searchTerm?: string }
) {
  const { pageSize = 50, page = 0, searchTerm = '' } = options || {};
  
  const params = React.useMemo(() => ({
    premise_id_param: premiseId,
    role_param: role,
    search_term_param: searchTerm,
    limit_param: pageSize,
    offset_param: page * pageSize
  }), [premiseId, role, searchTerm, pageSize, page]);

  const { data: rawData, isLoading, error } = useRpc<any[]>('search_premise_members', params, [params]);

  const data = React.useMemo(() => {
    if (!rawData) return null;
    return rawData.map(row => ({
      id: row.id,
      premise_id: row.premise_id,
      user_id: row.user_id,
      role: row.role as any,
      identity: row.identity,
      gate_id: row.gate_id,
      is_active: row.is_active,
      created_at: row.created_at,
      user: {
        name: row.user_name,
        email: row.user_email,
        photo_url: row.user_photo_url
      }
    })) as PremiseMember[];
  }, [rawData]);

  return { data, isLoading, error };
}
