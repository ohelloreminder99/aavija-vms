'use client';

import * as React from 'react';
import { useStaticCollection, WithId } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

export interface City {
  id?: string;
  name: string;
  districtId: string;
  districtName: string;
  stateId: string;
  stateName: string;
}

// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

/**
 * Hook to fetch cities once, optionally filtered by district on the client-side.
 * This is optimized to use a static fetch as the list of cities does not change frequently.
 * @param districtId Optional ID of the district to filter cities by.
 * @returns The same result as useStaticCollection: { data, isLoading, error }
 */
export function useCities(districtId?: string) {
  const query = React.useMemo(() => {
    // Always query all cities to avoid composite index requirement, filter on client
    return { table: 'cities', orderBy: { column: 'name', ascending: true }, __memo: true };
  }, []);

  const { data: allCities, isLoading, error } = useStaticCollection<City>(query as any);

  // Perform filtering on the client side
  const filteredData = React.useMemo(() => {
    if (!allCities) {
      return null;
    }
    if (districtId) {
      return allCities.filter((c) => c.districtId === districtId);
    }
    return allCities;
  }, [allCities, districtId]);

  return { data: filteredData, isLoading, error };
}


/**
 * Creates a new city document in Supabase.
 * @param _db Parameter ignored
 * @param data The city data.
 */
export async function createCity(_db: any, data: Omit<City, 'id'>) {
  const supabase = await createClient();
  const newCityData = {
    name: data.name.toLowerCase(),
    districtId: data.districtId,
    districtName: data.districtName.toLowerCase(),
    stateId: data.stateId,
    stateName: data.stateName.toLowerCase(),
  };
  const { error } = await supabase.from('cities').insert([newCityData]);
  if (error) throw error;
}

/**
 * Updates an existing city document.
 * @param _db Parameter ignored
 * @param id The ID of the city to update.
 * @param data The partial city data to update.
 */
export async function updateCity(
  _db: any,
  id: string,
  data: Partial<City>
) {
  const supabase = await createClient();
  const dataToUpdate: Partial<City> = {};
  if (data.name) dataToUpdate.name = data.name.toLowerCase();
  if (data.districtId) dataToUpdate.districtId = data.districtId;
  if (data.districtName) dataToUpdate.districtName = data.districtName.toLowerCase();
  if (data.stateId) dataToUpdate.stateId = data.stateId;
  if (data.stateName) dataToUpdate.stateName = data.stateName.toLowerCase();

  const { error } = await supabase.from('cities').update(dataToUpdate).eq('id', id);
  if (error) throw error;
}

/**
 * Deletes a city document.
 * @param _db Parameter ignored
 * @param id The ID of the city to delete.
 */
export async function deleteCity(_db: any, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('cities').delete().eq('id', id);
  if (error) throw error;
}

type CsvCity = { name: string; districtName: string; stateName: string };

/**
 * Creates multiple city documents using Supabase insert array.
 * @param _db Parameter ignored
 * @param cities An array of city data from the CSV.
 */
export async function batchCreateCities(
  _db: any,
  cities: CsvCity[]
) {
  const supabase = await createClient();
  // 1. Fetch all states and districts to create a lookup map
  const { data: states } = await supabase.from('states').select('*');
  const { data: districts } = await supabase.from('districts').select('*');

  const stateMap = new Map((states || []).map(doc => [doc.name.toLowerCase(), doc.id]));
  const districtMap = new Map((districts || []).map(doc => [doc.name.toLowerCase() + '|' + doc.stateId, doc.id]));
  const districtStateMap = new Map((districts || []).map(doc => [doc.id, { stateId: doc.stateId, stateName: doc.stateName }]));

  const newCitiesToInsert = cities.map((city) => {
    const stateNameLower = city.stateName.toLowerCase();
    const districtNameLower = city.districtName.toLowerCase();

    const stateId = stateMap.get(stateNameLower);
    if (!stateId) {
      throw new Error(`State '${city.stateName}' not found for city '${city.name}'. Please create the state first.`);
    }

    const districtId = districtMap.get(districtNameLower + '|' + stateId);
    if (!districtId) {
      throw new Error(`District '${city.districtName}' in state '${city.stateName}' not found for city '${city.name}'. Please create the district first.`);
    }

    const parentInfo = districtStateMap.get(districtId);

    return {
      name: city.name.toLowerCase(),
      districtId: districtId,
      districtName: districtNameLower,
      stateId: parentInfo?.stateId,
      stateName: parentInfo?.stateName
    };
  });

  const { error } = await supabase.from('cities').insert(newCitiesToInsert);
  if (error) throw error;
}
