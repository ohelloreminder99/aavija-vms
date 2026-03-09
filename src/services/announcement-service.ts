'use client';

import { useCollection, WithId } from '@/supabase';
import { type UserProfile } from '@/services/user-service';
import { useCities } from '@/services/city-service';
import * as React from 'react';
import { createClient } from '@/lib/supabase/client';


// === DATA TYPES ===

// Matches the Announcement entity in docs/backend.json
export type UserRole = 'owner' | 'visitor' | 'host' | 'gatekeeper' | 'staff' | 'admin';

export interface Announcement {
  id?: string;
  title: string;
  message: string;
  targetRoles: UserRole[];
  targetStates?: string[];
  targetDistricts?: string[];
  targetCities?: string[];
  createdAt: any;
  updatedAt: any;
}

// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

/**
 * Hook to fetch all announcements in real-time, ordered by creation date.
 */
export function useAnnouncements() {
  const query = React.useMemo(() => {
    return { table: 'announcements', orderBy: { column: 'createdAt', ascending: false }, __memo: true };
  }, []);

  return useCollection<Announcement>(query as any);
}


/**
 * A hook to fetch and filter announcements specifically for the logged-in user.
 * It filters based on the user's role and location (city, district, state).
 */
export function useAnnouncementsForUser(
  userProfile: WithId<UserProfile> | null,
  activeRole?: UserRole,
  activeCityId?: string,
  activeCityName?: string,
  activeStateName?: string
) {
  const { data: allAnnouncements, isLoading: isLoadingAnnouncements, error: errorAnnouncements } = useAnnouncements();
  const { data: allCities, isLoading: isLoadingCities, error: errorCities } = useCities();

  const announcementsForUser = React.useMemo(() => {
    if (!userProfile || !allAnnouncements || !allCities) {
      return [];
    }

    // 1. Determine the acting role. Default to the base role in the profile.
    const actingRole = activeRole || userProfile.role;

    // 2. Resolve the acting location.
    const targetCityId = activeCityId || userProfile.cityId;
    const cityName = (activeCityName || userProfile.city)?.toLowerCase().trim();
    const stateName = (activeStateName || userProfile.city_state)?.toLowerCase().trim();

    // 3. Find the full city object for robust matching.
    const userCity = allCities.find(c => {
      if (targetCityId && c.id === targetCityId) return true;

      // Fallback to name-based lookup for older profiles
      const nameMatch = c.name.toLowerCase().trim() === cityName;
      const stateMatch = stateName ? c.stateName.toLowerCase().trim() === stateName : true;
      return cityName && nameMatch && stateMatch;
    });

    return allAnnouncements.filter(ann => {
      // Role Check: Must be targeted to the acting role.
      if (!ann.targetRoles.includes(actingRole)) {
        return false;
      }

      // Location Check
      const targetedStates = ann.targetStates || [];
      const targetedDistricts = ann.targetDistricts || [];
      const targetedCities = ann.targetCities || [];

      const isLocationTargeted = targetedStates.length > 0 ||
        targetedDistricts.length > 0 ||
        targetedCities.length > 0;

      // If no location is targeted, the announcement is global for that role.
      if (!isLocationTargeted) {
        return true;
      }

      // If location is targeted, but the user's location is unknown, hide it.
      if (!userCity) {
        return false;
      }

      // Check if the user's specific city, or its parent district/state, is targeted.
      const matchCity = targetedCities.includes(userCity.id!);
      const matchDistrict = targetedDistricts.includes(userCity.districtId);
      const matchState = targetedStates.includes(userCity.stateId);

      return matchCity || matchDistrict || matchState;
    });
  }, [userProfile, allAnnouncements, allCities, activeRole, activeCityId, activeCityName, activeStateName]);

  return { data: announcementsForUser, isLoading: isLoadingAnnouncements || isLoadingCities, error: errorAnnouncements || errorCities };
}


/**
 * Creates a new announcement document.
 */
export async function createAnnouncement(
  _db: any,
  data: Omit<Announcement, 'createdAt' | 'updatedAt' | 'id'>
) {
  const supabase = createClient();
  const newAnnouncement = {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('announcements').insert([newAnnouncement]);
  if (error) throw error;
}

/**
 * Updates an existing announcement document.
 */
export async function updateAnnouncement(
  _db: any,
  id: string,
  data: Partial<Omit<Announcement, 'createdAt'>>
) {
  const supabase = createClient();
  const dataToUpdate = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from('announcements').update(dataToUpdate).eq('id', id);
  if (error) throw error;
}

/**
 * Deletes an announcement document.
 */
export async function deleteAnnouncement(_db: any, id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

