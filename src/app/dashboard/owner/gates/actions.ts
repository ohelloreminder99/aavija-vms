'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';

export interface GateActionParams {
  premiseId: string;
  name: string;
  description?: string;
  actor: { id: string; name: string; role: string };
}

export async function createGate({ premiseId, name, description, actor }: GateActionParams) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.from('premise_gates').insert({
    premise_id: premiseId,
    name,
    description
  }).select().single();

  if (error) {
    console.error('Error creating gate:', error);
    return { success: false, error: error.message };
  }

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.GATE_CREATED,
    description: `Owner "${actor.name}" created gate "${name}" at premise ${premiseId}.`
  });

  revalidatePath('/dashboard/owner/gates');
  return { success: true, gate: data };
}

export async function updateGate({ gateId, name, description, actor, premiseId }: GateActionParams & { gateId: string }) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.from('premise_gates')
    .update({ name, description })
    .eq('id', gateId)
    .select()
    .single();

  if (error) {
    console.error('Error updating gate:', error);
    return { success: false, error: error.message };
  }

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.GATE_UPDATED,
    description: `Owner "${actor.name}" updated gate "${name}".`
  });

  revalidatePath('/dashboard/owner/gates');
  return { success: true, gate: data };
}

export async function deleteGate({ gateId, gateName, actor, premiseId }: { gateId: string; gateName: string; actor: { id: string; name: string; role: string }; premiseId: string }) {
  const supabase = await createClient();
  
  // Check if any gatekeeper is assigned to this gate
  const { count } = await supabase.from('premise_members')
    .select('*', { count: 'exact', head: true })
    .eq('gate_id', gateId);

  if (count && count > 0) {
    return { success: false, error: 'Cannot delete gate with assigned gatekeepers. Reassign them first.' };
  }

  const { error } = await supabase.from('premise_gates').delete().eq('id', gateId);

  if (error) {
    console.error('Error deleting gate:', error);
    return { success: false, error: error.message };
  }

  await createLogEntry({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: LogAction.GATE_DELETED,
    description: `Owner "${actor.name}" deleted gate "${gateName}".`
  });

  revalidatePath('/dashboard/owner/gates');
  return { success: true };
}
