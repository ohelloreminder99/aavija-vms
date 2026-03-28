'use client';

import * as React from 'react';
import { useCollection } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

/**
 * Hook to fetch all payout requests in real-time.
 */
export function usePayoutRequests(options?: { status?: string; pageSize?: number; page?: number }) {
    const [refreshKey, setRefreshKey] = React.useState(0);
    const { status, pageSize = 50, page = 0 } = options || {};

    React.useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('payouts-global-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payout_requests' },
                () => setRefreshKey(prev => prev + 1)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const query = React.useMemo(() => {
        const filters = status ? [{ column: 'status', operator: 'eq' as const, value: status }] : [];
        return {
            table: 'payout_requests',
            filters,
            orderBy: { column: 'requested_at', ascending: false },
            limit: pageSize,
            offset: page * pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [status, pageSize, page, refreshKey]);

    return useCollection<any>(query as any);
}

/**
 * Hook to fetch all agents (users with is_agent = true) in real-time.
 */
export function useAllAgents(options?: { pageSize?: number; page?: number }) {
    const [refreshKey, setRefreshKey] = React.useState(0);
    const { pageSize = 50, page = 0 } = options || {};

    React.useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('agents-global-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                () => setRefreshKey(prev => prev + 1)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const query = React.useMemo(() => {
        return {
            table: 'users',
            filters: [{ column: 'is_agent', operator: 'eq' as const, value: true }],
            orderBy: { column: 'name', ascending: true },
            limit: pageSize,
            offset: page * pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [pageSize, page, refreshKey]);

    return useCollection<any>(query as any);
}

/**
 * Hook to fetch users pending KYC verification in real-time.
 */
export function usePendingKYC(options?: { pageSize?: number; page?: number }) {
    const [refreshKey, setRefreshKey] = React.useState(0);
    const { pageSize = 50, page = 0 } = options || {};

    React.useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('kyc-global-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                () => setRefreshKey(prev => prev + 1)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const query = React.useMemo(() => {
        return {
            table: 'users',
            filters: [
                { column: 'kyc_verified', operator: 'eq' as const, value: false },
                { column: 'pan_number', operator: 'neq' as const, value: null } // Users who submitted KYC but aren't verified yet
            ],
            orderBy: { column: 'name', ascending: true },
            limit: pageSize,
            offset: page * pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [pageSize, page, refreshKey]);

    return useCollection<any>(query as any);
}
