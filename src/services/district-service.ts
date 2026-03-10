'use client';

import * as React from 'react';
import { useStaticCollection } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

export interface District {
  id?: string;
  name: string;
  stateId: string;
  stateName: string;
}

// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

/**
 * Hook to fetch districts once, optionally filtered by state on the client-side.
 * This is optimized to use a static fetch as the list of districts does not change frequently.
 * @param stateId Optional ID of the state to filter districts by.
 * @returns The same result as useStaticCollection: { data, isLoading, error }
 */
export function useDistricts(stateId?: string) {
  const query = React.useMemo(() => {
    // Always query all districts, ordered by name.
    return { table: 'districts', orderBy: { column: 'name', ascending: true }, __memo: true };
  }, []);

  const { data: allDistricts, isLoading, error } = useStaticCollection<District>(query as any);

  const filteredData = React.useMemo(() => {
    if (!allDistricts) {
      return null;
    }
    if (stateId) {
      return allDistricts.filter((d) => d.stateId === stateId);
    }
    return allDistricts;
  }, [allDistricts, stateId]);

  return { data: filteredData, isLoading, error };
}


/**
 * Creates a new district document.
 * @param _db Parameter ignored
 * @param data The district data.
 */
export async function createDistrict(_db: any, data: Omit<District, 'id'>) {
  const supabase = await createClient();
  const newDistrictData = {
    name: data.name.toLowerCase(),
    stateId: data.stateId,
    stateName: data.stateName.toLowerCase(),
  };
  const { error } = await supabase.from('districts').insert([newDistrictData]);
  if (error) throw error;
}

/**
 * Updates an existing district document.
 * @param _db Parameter ignored
 * @param id The ID of the district to update.
 * @param data The partial district data to update.
 */
export async function updateDistrict(
  _db: any,
  id: string,
  data: Partial<District>
) {
  const supabase = await createClient();
  const dataToUpdate: Partial<District> = {};
  if (data.name) dataToUpdate.name = data.name.toLowerCase();
  if (data.stateId) dataToUpdate.stateId = data.stateId;
  if (data.stateName) dataToUpdate.stateName = data.stateName.toLowerCase();
  const { error } = await supabase.from('districts').update(dataToUpdate).eq('id', id);
  if (error) throw error;
}

/**
 * Deletes a district document.
 * @param _db Parameter ignored
 * @param id The ID of the district to delete.
 */
export async function deleteDistrict(_db: any, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('districts').delete().eq('id', id);
  if (error) throw error;
}


type CsvDistrict = { name: string; stateName: string };

/**
 * Creates multiple district documents using Supabase insert.
 * @param _db Parameter ignored
 * @param districts An array of district data from the CSV.
 */
export async function batchCreateDistricts(
  _db: any,
  districts: CsvDistrict[]
) {
  const supabase = await createClient();
  // 1. Fetch all states to create a lookup map of state name to state ID
  const { data: states } = await supabase.from('states').select('*');
  const stateMap = new Map((states || []).map(doc => [doc.name.toLowerCase(), doc.id]));

  const newDistrictsToInsert = districts.map((district) => {
    const stateNameLower = district.stateName.toLowerCase();
    const stateId = stateMap.get(stateNameLower);

    if (!stateId) {
      throw new Error(`State '${district.stateName}' not found for district '${district.name}'. Please create the state first.`);
    }

    return {
      name: district.name.toLowerCase(),
      stateId: stateId,
      stateName: stateNameLower
    };
  });

  const { error } = await supabase.from('districts').insert(newDistrictsToInsert);
  if (error) throw error;
}
