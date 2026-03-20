'use server';
 
import { getAdminDb } from '@/lib/supabase/server';
import { z } from 'zod';
import { checkRateLimit, contactRateLimit } from '@/lib/rate-limit'; 
import { headers } from 'next/headers';
 
const ContactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
});
 
/**
 * Securely submits a contact form from the client.
 * Uses getAdminDb() to bypass RLS since the public INSERT policy was removed for security.
 */
export async function submitContactForm(payload: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    // 1. Rate Limiting
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || '127.0.0.1';
    const rateCheck = await checkRateLimit(contactRateLimit, `contact:${ip}`);
    
    if (!rateCheck.success) {
      return { success: false, error: 'Too many submissions. Please try again later.' };
    }

    // 2. Validation
    const validated = ContactSchema.parse(payload);
 
    // 3. Database Writing
    const adminDb = await getAdminDb();
    if (!adminDb) throw new Error('Database connection failed.');
 
    const { error } = await adminDb.from('contact_submissions').insert({
      name: validated.name,
      email: validated.email,
      message: validated.message,
      created_at: new Date().toISOString(),
    });
 
    if (error) throw error;
 
    return { success: true };
  } catch (e: any) {
    console.error('[ContactAction] Submission failed:', e);
    return { success: false, error: e.message || 'Failed to submit message.' };
  }
}
