'use server';

import { getAdminDb, requireAuth } from '@/lib/supabase/server';
import { Invoice } from '@/services/invoice-service';

export type SerializableInvoice = Omit<Invoice, 'timestamp'> & { timestamp: string };

/**
 * Fetches all invoices for a specific month and year.
 */
export async function getMonthlyInvoices(month: number, year: number): Promise<{
    invoices?: SerializableInvoice[];
    error?: string;
}> {
    const adminDb = await getAdminDb();
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) return { error: "Admin database not available." };

    try {
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

        const { data: snapshot, error } = await adminDb
            .from('invoices')
            .select('*')
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const invoices: SerializableInvoice[] = (snapshot || []).map((data: any) => {
            return {
                ...data,
                timestamp: data.created_at || data.timestamp
            };
        });

        return { invoices };
    } catch (e: any) {
        console.error("Error fetching monthly invoices:", e);
        return { error: e.message || "Failed to fetch invoices." };
    }
}

/**
 * Calculates reconciliation data comparing Invoices vs Token Purchase Logs.
 */
export async function getReconciliationData(month: number, year: number): Promise<{
    data?: {
        totalInvoiceAmount: number;
        invoiceCount: number;
        paymentLogCount: number;
        isReconciled: boolean;
    };
    error?: string;
}> {
    const adminDb = await getAdminDb();
    const { profile } = await requireAuth();
    if (profile.role !== 'admin') throw new Error('Unauthorized');
    if (!adminDb) return { error: "Admin database not available." };

    try {
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

        // 1. Get Invoice Data
        const { data: invoices, error: invError } = await adminDb
            .from('invoices')
            .select('total_amount')
            .gte('created_at', startOfMonth)
            .lte('created_at', endOfMonth);

        if (invError) throw invError;

        // 2. Get Payment Log Data
        const { data: logs, error: logError } = await adminDb
            .from('logs')
            .select('id')
            .eq('action', 'TOKEN_PURCHASE')
            .gte('timestamp', startOfMonth)
            .lte('timestamp', endOfMonth);

        if (logError) throw logError;

        const totalInvoiceAmount = (invoices || []).reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
        const invoiceCount = invoices?.length || 0;
        const paymentLogCount = logs?.length || 0;

        return {
            data: {
                totalInvoiceAmount,
                invoiceCount,
                paymentLogCount,
                isReconciled: invoiceCount === paymentLogCount
            }
        };
    } catch (e: any) {
        console.error("Error fetching reconciliation data:", e);
        return { error: e.message || "Failed to reconcile data." };
    }
}
