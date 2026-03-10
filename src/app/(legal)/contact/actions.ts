'use server';

import { getAdminDb } from "@/lib/supabase/server";

interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

export async function submitContactForm(data: ContactFormData): Promise<{ success: boolean; error?: string }> {
    const adminDb = await getAdminDb();
    if (!adminDb) {
        return { success: false, error: "Server database connection not available." };
    }

    try {
        const { error } = await adminDb.from('contact_submissions').insert({
            ...data,
            createdAt: new Date().toISOString(),
        });
        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Error submitting contact form:", e);
        return { success: false, error: e.message || "An unexpected error occurred on the server." };
    }
}
