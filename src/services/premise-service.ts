'use client';

import { useStaticCollection, useCollection, useDoc, useRpc } from '@/supabase';
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
  availability: HostAvailability;
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
  cityId?: string;
  city_state?: string;
  is_active: boolean;
  owner_id: string;
  ownerName?: string;
  token_balance: number;
  agent_id?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  staff?: StaffMember[]; 
  host_count?: number;
  gatekeeper_count?: number;
  gate_count?: number;
  gstNumber?: string;
  billingAddress?: string;
  legalName?: string;
  billingState?: string;
  require_host_verification?: boolean;
  
  // Joined relations for UI convenience
  owner?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    photo_url: string;
  };
  agent?: {
    id: string;
    name: string;
    email?: string;
  };
  category?: {
    id: string;
    name: string;
  };
}

// === REPOSITORY FUNCTIONS (HOOKS) ===

/**
 * Hook to fetch all premises with real-time updates.
 */
export function usePremises(options?: { pageSize?: number; page?: number }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { pageSize = 50, page = 0 } = options || {};

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('premises-global-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premises' },
        () => setRefreshKey(prev => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const query = React.useMemo(() => {
    return { 
      table: 'premises', 
      limit: pageSize,
      offset: page * pageSize,
      __memo: true,
      __refresh: refreshKey 
    };
  }, [pageSize, page, refreshKey]);

  return useCollection<Premise>(query as any);
}

/**
 * Hook to fetch a single premise by its ID.
 * @param premiseId The ID of the premise to fetch.
 * @returns The same result as useDoc: { data, isLoading, error }
 */
export function usePremiseById(premise_id: string | undefined) {
  const docRef = React.useMemo(() => {
    if (!premise_id) return null;
    return { table: 'premises', id: premise_id, __memo: true };
  }, [premise_id]);

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
export function usePremiseGates(premise_id: string | undefined) {
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!premise_id) return;
    
    const supabase = createClient();
    const channel = supabase
      .channel(`gates-realtime-${premise_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'premise_gates',
          filter: `premise_id=eq.${premise_id}`
        },
        () => {
          setRefreshKey(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [premise_id]);

  const query = React.useMemo(() => {
    if (!premise_id) return null;
    return {
      table: 'premise_gates',
      filters: [{ column: 'premise_id', operator: 'eq' as const, value: premise_id }],
      orderBy: { column: 'name', ascending: true },
      __memo: true,
      __refresh: refreshKey // Force useCollection to re-evaluate
    };
  }, [premise_id, refreshKey]);

  return useCollection<PremiseGate>(query as any);
}

/**
 * Hook to fetch members (Hosts/Gatekeepers) for a specific premise with pagination.
 */
export function usePremiseMembers(
  premise_id: string | undefined, 
  role?: 'host' | 'gatekeeper',
  options?: { pageSize?: number; page?: number; searchTerm?: string }
) {
  const { pageSize = 50, page = 0, searchTerm = '' } = options || {};
  
  const params = React.useMemo(() => ({
    premise_id_param: premise_id,
    role_param: role,
    search_term_param: searchTerm,
    limit_param: pageSize,
    offset_param: page * pageSize
  }), [premise_id, role, searchTerm, pageSize, page]);

  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!premise_id) return;
    
    const supabase = createClient();
    const channel = supabase
      .channel(`members-realtime-${premise_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'premise_members',
          filter: `premise_id=eq.${premise_id}`
        },
        () => {
          setRefreshKey(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [premise_id]);

  const { data: rawData, isLoading, error } = useRpc<any[]>('search_premise_members', params, [params, refreshKey]);

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
      availability: row.availability as HostAvailability,
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

/**
 * Hook to fetch all premise applications in real-time.
 */
export function usePremiseApplications(options?: { pageSize?: number; page?: number }) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { pageSize = 50, page = 0 } = options || {};

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('premise-apps-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premise_applications' },
        () => setRefreshKey(prev => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const query = React.useMemo(() => {
    return { 
      table: 'premise_applications', 
      orderBy: { column: 'created_at', ascending: false },
      limit: pageSize,
      offset: page * pageSize,
      __memo: true,
      __refresh: refreshKey 
    };
  }, [pageSize, page, refreshKey]);

  return useCollection<any>(query as any);
}
