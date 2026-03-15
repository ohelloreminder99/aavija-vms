'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from '@/services/log-actions';
import { createLogEntry } from '@/services/log-service';

export interface BulkMemberData {
  name: string;
  email: string;
  identity: string; // Unit / Flat No
}

interface BulkEnrollResult {
  success: boolean;
  count: number;
  errors: string[];
}

/**
 * Bulk enrolls hosts into a premise.
 * handles user creation if they don't exist.
 */
export async function bulkEnrollHosts(
  premiseId: string,
  members: BulkMemberData[],
  actor: { id: string; name: string; role: string }
): Promise<BulkEnrollResult> {
  const adminDb = await getAdminDb();
  if (!adminDb) return { success: false, count: 0, errors: ['Admin DB not available'] };

  const { user: authUser, profile } = await requireAuth();
  
  // Permission check
  if (profile.role !== 'admin') {
    const { data: permCheck } = await adminDb.from('premises').select('owner_id').eq('id', premiseId).single();
    if (!permCheck || permCheck.owner_id !== authUser.id) {
      throw new Error('Unauthorized');
    }
  }

  let enrolledCount = 0;
  const errors: string[] = [];

  // We process in small chunks to avoid auth API rate limits and long-running transaction issues
  for (const member of members) {
    try {
      // 1. Create User in Auth if not exists
      // We first check if the user exists in our users table
      const { data: existingUser } = await adminDb.from('users').select('id').eq('email', member.email).single();
      
      let targetUserId: string;

      if (!existingUser) {
        // Create new auth user
        const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
          email: member.email,
          password: Math.random().toString(36).slice(-12), // Random password for bulk created
          email_confirm: true,
          user_metadata: { name: member.name }
        });

        if (authError) throw authError;
        targetUserId = authData.user!.id;

        // Create Profile
        await adminDb.from('users').insert({
          id: targetUserId,
          name: member.name,
          email: member.email,
          role: 'visitor',
          is_active: true,
          is_verified: false,
        });
      } else {
        targetUserId = existingUser.id;
      }

      // 2. Add to Premise Members
      const { error: memberError } = await adminDb.from('premise_members').upsert({
        premise_id: premiseId,
        user_id: targetUserId,
        role: 'host',
        identity: member.identity,
        is_active: true
      }, { onConflict: 'premise_id, user_id, role' });

      if (memberError) throw memberError;
      
      enrolledCount++;
    } catch (e: any) {
      errors.push(`Error for ${member.email}: ${e.message}`);
    }
  }

  if (enrolledCount > 0) {
    await createLogEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: LogAction.HOST_CREATED,
      description: `Owner "${actor.name}" bulk enrolled ${enrolledCount} hosts.`
    });
    revalidatePath('/dashboard/owner/hosts');
  }

  return {
    success: errors.length === 0,
    count: enrolledCount,
    errors
  };
}
