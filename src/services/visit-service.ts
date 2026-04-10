'use client';

import * as React from 'react';
import { useCollection, useDoc } from '@/supabase';
import { createClient } from '@/lib/supabase/client';

// === DATA TYPES ===

// Matches the Visit entity in docs/backend.json
export interface Visit {
    id?: string;
    visitor_id: string;
    visitor_name: string;
    host_id: string;
    host_name?: string;
    premise_id: string;
    premise_name?: string;
    checkin_time: string;
    checkout_time: string | null;
    expiresAt?: string;
    vehicle_details?: {
        plate: string;
        model: string;
    };
    visitor_snapshot_url?: string;
    status: 'active' | 'completed' | 'declined' | 'force_closed';
    checkin_gate_id?: string;
    checkout_gate_id?: string;
    host_verified_at?: string;
}


// === REPOSITORY FUNCTIONS (HOOKS) ===

/**
 * Hook to fetch a single visit document.
 * @param userId The ID of the user.
 * @param visitId The ID of the visit to fetch.
 * @returns The same result as useDoc: { data, isLoading, error }
 */
export function useVisitByIdForUser(user_id: string | undefined, visit_id: string | null | undefined) {
    const docRef = React.useMemo(() => {
        if (!user_id || !visit_id) return null;
        return { table: 'visits', id: visit_id, __memo: true };
    }, [user_id, visit_id]);

    return useDoc<Visit>(docRef);
}


/**
 * Hook to fetch visits for a specific premise, ordered by check-in time.
 * Real-time enabled.
 * @param premiseId The ID of the premise to fetch visits for.
 * @param pageSize Number of visits to fetch per page (default 50).
 */
export function useVisitsByPremise(premise_id: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!premise_id) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`visits-premise-realtime-${premise_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `premise_id=eq.${premise_id}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [premise_id]);

    const query = React.useMemo(() => {
        if (!premise_id) return null;
        return {
            table: 'visits',
            filters: [{ column: 'premise_id', operator: 'eq' as const, value: premise_id }],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [premise_id, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

/**
 * Hook to fetch visits for a specific host at a specific premise.
 * Real-time enabled.
 * @param hostId The ID of the host to fetch visits for.
 * @param premiseId The ID of the premise to fetch visits from.
 * @param pageSize Number of visits to fetch per page (default 50).
 */
export function useVisitsForHost(host_id: string | undefined, premise_id: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!host_id || !premise_id) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`visits-host-realtime-${host_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `host_id=eq.${host_id}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [host_id, premise_id]);

    const query = React.useMemo(() => {
        if (!host_id || !premise_id) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'premise_id', operator: 'eq' as const, value: premise_id },
                { column: 'host_id', operator: 'eq' as const, value: host_id }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [host_id, premise_id, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

/**
 * Hook to fetch a user's single active visit.
 * Real-time enabled.
 * @param userId The ID of the user.
 */
export function useUserActiveVisit(user_id: string | undefined) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!user_id) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`user-active-visit-realtime-${user_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `visitor_id=eq.${user_id}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user_id]);

    const query = React.useMemo(() => {
        if (!user_id) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'visitor_id', operator: 'eq' as const, value: user_id },
                { column: 'status', operator: 'eq' as const, value: 'active' }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: 1,
            __memo: true,
            __refresh: refreshKey
        };
    }, [user_id, refreshKey]);

    const { data, isLoading, error } = useCollection<Visit>(query as any);
    return { data: data?.[0] || null, isLoading, error };
}

/**
 * Hook to fetch only ACTIVE visits for a specific premise.
 * Real-time enabled.
 */
export function useActiveVisitsForPremise(premise_id: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!premise_id) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`active-visits-realtime-${premise_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `premise_id=eq.${premise_id}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [premise_id]);

    const query = React.useMemo(() => {
        if (!premise_id) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'premise_id', operator: 'eq' as const, value: premise_id },
                { column: 'status', operator: 'eq' as const, value: 'active' }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [premise_id, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

