'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { ContactSubmission } from '@/services/contact-service';

export type SerializableContactSubmission = Omit<ContactSubmission, 'created_at'> & { id: string; createdAt: string };

export async function getContactSubmissions(): Promise<{ submissions?: SerializableContactSubmission[]; error?: string }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { error: 'Server is not configured for admin access.' };
  }

  try {
    const { data: submissions, error } = await adminDb
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!submissions || submissions.length === 0) {
      return { submissions: [] };
    }

    return { submissions };
  } catch (error: any) {
    console.error('Error fetching contact submissions:', error);
    if (error.message && (error.message.includes('Could not refresh access token') || error.message.includes('Credential'))) {
      return { error: 'Could not access database with admin privileges.' };
    }
    return { error: error.message || 'An unknown server error occurred.' };
  }
}

export async function deleteContactSubmission(submissionId: string): Promise<{ success: boolean; error?: string }> {
  const adminDb = await getAdminDb();
  const { profile } = await requireAuth();
  if (profile.role !== 'admin') throw new Error('Unauthorized');
  if (!adminDb) {
    return { success: false, error: 'Server is not configured for admin access.' };
  }

  try {
    const { error } = await adminDb.from('contact_submissions').delete().eq('id', submissionId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting contact submission:', error);
    if (error.message && (error.message.includes('Could not refresh access token') || error.message.includes('Credential'))) {
      return { success: false, error: 'Could not access database with admin privileges.' };
    }
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}