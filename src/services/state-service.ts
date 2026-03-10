'use client';

import * as React from 'react';
import { useStaticCollection } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

export interface State {
  id?: string;
  name: string;
}

// === REPOSITORY FUNCTIONS (HOOKS & ASYNC) ===

/**
 * Hook to fetch all states once.
 * @returns The same result as useStaticCollection: { data, isLoading, error }
 */
export function useStates() {
  const query = React.useMemo(() => {
    return { table: 'states', orderBy: { column: 'name', ascending: true }, __memo: true };
  }, []);

  return useStaticCollection<State>(query as any);
}

/**
 * Creates a new state document.
 * @param _db Parameter ignored
 * @param data The state data.
 */
export async function createState(_db: any, data: State) {
  const supabase = await createClient();
  const { error } = await supabase.from('states').insert([{ name: data.name.toLowerCase() }]);
  if (error) throw error;
}

/**
 * Updates an existing state document.
 * @param _db Parameter ignored
 * @param id The ID of the state to update.
 * @param data The partial state data to update.
 */
export async function updateState(
  _db: any,
  id: string,
  data: Partial<State>
) {
  const supabase = await createClient();
  const dataToUpdate: Partial<State> = {};
  if (data.name) {
    dataToUpdate.name = data.name.toLowerCase();
  }
  const { error } = await supabase.from('states').update(dataToUpdate).eq('id', id);
  if (error) throw error;
}

/**
 * Deletes a state document.
 * @param _db Parameter ignored
 * @param id The ID of the state to delete.
 */
export async function deleteState(_db: any, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('states').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Creates multiple state documents using Supabase inserts.
 * @param _db Parameter ignored
 * @param states An array of state data to create.
 */
export async function batchCreateStates(
  _db: any,
  states: State[]
) {
  const supabase = await createClient();
  const newStates = states.map((state) => ({ name: state.name.toLowerCase() }));
  const { error } = await supabase.from('states').insert(newStates);
  if (error) throw error;
}
