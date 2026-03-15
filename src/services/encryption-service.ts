'use server';

import { getAdminDb } from '@/lib/supabase/server';

/**
 * Decrypts a PII string using the database-level pgp_sym_decrypt.
 * This ensures that the encryption key never leaves the database layer
 * while allowing the application server to display decrypted data to authorized users.
 */
export async function decryptPII(encryptedData: string): Promise<string> {
  if (!encryptedData || encryptedData.length < 10) return encryptedData; // Likely not encrypted

  const adminDb = await getAdminDb();
  if (!adminDb) return encryptedData;

  try {
    const { data, error } = await adminDb.rpc('decrypt_pii', { p_encoded_data: encryptedData });
    if (error) throw error;
    return data || encryptedData;
  } catch (err) {
    console.error('[EncryptionService] Decryption failed:', err);
    return encryptedData;
  }
}

/**
 * Bulk decrypts a list of objects containing PII.
 * Useful for lists of visits or user profiles.
 */
export async function bulkDecryptPII<T>(items: T[], piiField: keyof T): Promise<T[]> {
  const adminDb = await getAdminDb();
  if (!adminDb) return items;

  try {
    const decryptedItems = await Promise.all(items.map(async (item) => {
      const val = item[piiField];
      if (typeof val === 'string') {
        const decrypted = await decryptPII(val);
        return { ...item, [piiField]: decrypted };
      }
      return item;
    }));
    return decryptedItems;
  } catch (err) {
    console.error('[EncryptionService] Bulk decryption failed:', err);
    return items;
  }
}
