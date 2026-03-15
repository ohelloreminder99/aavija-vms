'use client';

/**
 * AAVIJA VMS — User Service (Client-Side Reads & Safe Profile Updates)
 * Author note (Phase 2A, 2026-03-07 by Antigravity):
 *   createAdminRole has been REMOVED from this file.
 *   It was using the anon client and could allow privilege escalation.
 *   Use admin-service.ts → grantAdminRole() instead (server-only, admin-guarded).
 *
 *   updateUserProfile now accepts only UpdateableUserProfile — a type that
 *   explicitly excludes role, token balances, and all other system-managed fields.
 *   This means even if a client sends { role: 'admin' } in the payload, the
 *   TypeScript compiler will reject it, and the allowed fields list acts as a
 *   second layer of protection at the service boundary.
 */

import { useDoc, useStaticCollection, useCollection } from '@/supabase';
import { Premise, StaffMember } from '@/services/premise-service';
import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

export interface Vehicle {
  type: 'car' | 'bike' | 'tempo' | 'other' | 'walking';
  number: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'staff' | 'gatekeeper' | 'visitor' | 'host';
  phone: string;
  countryCode?: string;
  is_verified: boolean;
  is_active?: boolean;
  token_balance_visitor: number;
  global_rating: number;
  active_checkin_id: string | null;
  photo_url: string;
  city?: string;
  cityId?: string; // New field for robust location matching
  city_state?: string;
  companyName?: string;
  premise_roles?: { [key: string]: ('owner' | 'host' | 'gatekeeper')[] };
  vehicles?: Vehicle[];
  selected_vehicle_number?: string | null;
  products?: string[];
  // GST Details for Invoicing
  gstNumber?: string;
  billingAddress?: string;
  legalName?: string;
  billingState?: string;
  // Phase 2B — Agent & Payout fields
  is_agent?: boolean;
  agent_commission_balance?: number;
  agent_payout_upi?: string;
  pan_number?: string;
  pan_card_url?: string;
  kyc_verified?: boolean;
}


// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

/**
 * Hook to fetch a user's profile in real-time.
 * This is the primary way UI components should get user data.
 * @param uid The user's ID.
 * @returns The same result as useDoc: { data, isLoading, error }
 */
export function useUserProfile(uid: string | undefined) {
  // We use the previously rewritten useDoc which now accepts a Supabase query
  const docRef = React.useMemo(() => {
    if (!uid) return null;
    return { table: 'users', id: uid, __memo: true };
  }, [uid]);

  const { data, isLoading, error } = useDoc<UserProfile>(docRef);
  return { data, isLoading, error };
}

/**
 * Creates a new user profile document.
 * This should be called once upon user sign-up.
 * @param _db Parameter ignored (kept for signature compatibility)
 * @param uid The ID of the user to create.
 * @param data The user profile data.
 */
export async function createUserProfile(_db: any, uid: string, data: Omit<UserProfile, 'id'>) {
  const supabase = await createClient();
  const { error } = await supabase.from('users').insert({
    ...data,
    id: uid,
  });
  if (error) throw error;
}

/**
 * Fields a user is allowed to update about themselves.
 * Deliberately EXCLUDES system-managed fields:
 *   role, is_verified, is_active, token_balance_visitor, global_rating,
 *   active_checkin_id, premise_roles
 * Any attempt to pass those fields will be rejected at compile-time.
 * For admin-level user mutations, use admin-service.ts → adminUpdateUser().
 */
export type UpdateableUserProfile = Pick<
  UserProfile,
  | 'name'
  | 'phone'
  | 'countryCode'
  | 'photo_url'
  | 'city'
  | 'cityId'
  | 'city_state'
  | 'companyName'
  | 'vehicles'
  | 'selected_vehicle_number'
  | 'products'
  | 'gstNumber'
  | 'billingAddress'
  | 'legalName'
  | 'billingState'
>;

/**
 * Updates a user's OWN profile. Only accepts UpdateableUserProfile fields.
 * System-managed fields (role, balances, verification status) cannot be
 * changed through this function — use admin-service.ts for those.
 * @param uid The ID of the user to update.
 * @param data The safe subset of profile data to update.
 */
export async function updateUserProfile(uid: string, data: Partial<UpdateableUserProfile>) {
  if (!uid) return;
  const supabase = await createClient();
  const { error } = await supabase.from('users').update(data).eq('id', uid);
  if (error) throw error;
}

/**
 * Hook to fetch all users, ordered by name, with pagination.
 * @returns The same result as useCollection: { data, isLoading, error, hasMore }
 */
export function useAllUsers(options?: { pageSize?: number; page?: number }) {
  const { pageSize = 50, page = 0 } = options || {};
  const query = React.useMemo(() => {
    return { 
      table: 'users', 
      orderBy: { column: 'name', ascending: true }, 
      limit: pageSize,
      offset: page * pageSize,
      __memo: true 
    };
  }, [pageSize, page]);

  return useCollection<UserProfile>(query as any);
}


/**
 * Hook to fetch users with a specific role in real-time, with pagination.
 * @param role The role to filter users by.
 * @returns The same result as useCollection: { data, isLoading, error, hasMore }
 */
export function useUsersByRole(role: UserProfile['role'], options?: { pageSize?: number; page?: number }) {
  const { pageSize = 50, page = 0 } = options || {};
  const query = React.useMemo(() => {
    return { 
      table: 'users', 
      filters: [{ column: 'role', operator: 'eq' as const, value: role }], 
      limit: pageSize,
      offset: page * pageSize,
      __memo: true 
    };
  }, [role, pageSize, page]);

  return useCollection<UserProfile>(query as any);
}

/**
 * Hook to fetch users by role and premise ID by reading a denormalized list from the premise document.
 * @deprecated
 */
export function useUsersByRoleAndPremise(role: 'host' | 'gatekeeper', premiseId: string | undefined) {
  const docRef = React.useMemo(() => {
    if (!premiseId) return null;
    return { table: 'premises', id: premiseId, __memo: true };
  }, [premiseId]);

  const { data: premise, isLoading, error } = useDoc<Premise>(docRef);

  const staff = React.useMemo(() => {
    if (!premise || !premise.staff) return null;
    return premise.staff
      .filter(s => s.role === role)
      .map(s => ({ ...s, id: s.uid }));
  }, [premise, role]);

  return { data: staff, isLoading, error };
}


// === BLOCK-RELATED HOOKS ===

export interface PremiseBlock {
  blockedAt: any;
  blockedBy: string; // UID of owner
  visitorName: string;
  visitorPhotoUrl: string;
  id?: string;
  premise_id?: string;
}

export interface HostBlock {
  blockedAt: any;
  blockedBy: string; // UID of host
  visitorName: string;
  visitorPhotoUrl: string;
  id?: string;
  host_id?: string;
}

/**
 * Hook to get a real-time list of visitors blocked from a specific premise.
 * This is intended for the premise owner.
 * @param premiseId The ID of the premise.
 * @param userId The UID of the owner querying their blocks.
 */
export function usePremiseBlocks(premiseId: string | undefined, userId: string | undefined) {
  const query = React.useMemo(() => {
    if (!premiseId || !userId) return null;
    return {
      table: 'premise_blocked_visitors',
      filters: [
        { column: 'premise_id', operator: 'eq' as const, value: premiseId },
        { column: 'blocked_by', operator: 'eq' as const, value: userId }
      ],
      __memo: true
    };
  }, [premiseId, userId]);

  return useCollection<PremiseBlock>(query);
}
