'use server';

/**
 * App Check has been removed as part of the Firebase to Supabase migration.
 * This is a placeholder to prevent breaking existing imports.
 */
export async function verifyAppCheck() {
  console.log('App Check: Verification skipped. Supabase RLS is used for security.');
  return;
}
