'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { createLogEntry } from './log-service';
import { LogAction } from './log-actions';

// This type must match the one in premise-category-service.ts
export interface PremiseCategory {
  id?: string;
  name: string;
  type: 'industrial' | 'residential';
  deduction_rate_visitor: number;
  deduction_rate_premise: number;
  pdf_export_cost: number;
  csv_export_cost: number;
}

interface Actor {
  id: string;
  name: string;
  role: string;
}

/**
 * Creates a new premise category document and logs the action.
 * @param data The category's data.
 * @param actor The user performing the action.
 */
export async function createPremiseCategoryAction(data: PremiseCategory, actor: Actor) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Admin database is not available.');
  }

  const { error } = await adminDb.from('premise_categories').insert({ ...data, type: 'standard' });
  if (error) throw error;

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.CREATE_PREMISE_CATEGORY,
    description: `Admin "${actor.name}" created premise category "${data.name}".`,
  });
}

/**
 * Updates an existing premise category document and logs the action.
 * @param id The ID of the category to update.
 * @param data The partial category data to update.
 * @param actor The user performing the action.
 */
export async function updatePremiseCategoryAction(id: string, data: Partial<PremiseCategory>, actor: Actor) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Admin database is not available.');
  }

  const { error } = await adminDb.from('premise_categories').update(data).eq('id', id);
  if (error) throw error;

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.UPDATE_PREMISE_CATEGORY,
    description: `Admin "${actor.name}" updated premise category "${data.name || id}".`,
  });
}

/**
 * Deletes a premise category document and logs the action.
 * @param id The ID of the category to delete.
 * @param actor The user performing the action.
 */
export async function deletePremiseCategoryAction(id: string, actor: Actor) {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Admin database is not available.');
  }

  const { error } = await adminDb.from('premise_categories').delete().eq('id', id);
  if (error) throw error;

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.DELETE_PREMISE_CATEGORY,
    description: `Admin "${actor.name}" deleted premise category (ID: ${id}).`,
  });
}
