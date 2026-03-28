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
export function useVisitByIdForUser(userId: string | undefined, visitId: string | null | undefined) {
    const docRef = React.useMemo(() => {
        if (!userId || !visitId) return null;
        return { table: 'visits', id: visitId, __memo: true };
    }, [userId, visitId]);

    return useDoc<Visit>(docRef);
}


/**
 * Hook to fetch visits for a specific premise, ordered by check-in time.
 * Real-time enabled.
 * @param premiseId The ID of the premise to fetch visits for.
 * @param pageSize Number of visits to fetch per page (default 50).
 */
export function useVisitsByPremise(premiseId: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!premiseId) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`visits-premise-realtime-${premiseId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `premise_id=eq.${premiseId}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [premiseId]);

    const query = React.useMemo(() => {
        if (!premiseId) return null;
        return {
            table: 'visits',
            filters: [{ column: 'premise_id', operator: 'eq' as const, value: premiseId }],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [premiseId, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

/**
 * Hook to fetch visits for a specific host at a specific premise.
 * Real-time enabled.
 * @param hostId The ID of the host to fetch visits for.
 * @param premiseId The ID of the premise to fetch visits from.
 * @param pageSize Number of visits to fetch per page (default 50).
 */
export function useVisitsForHost(hostId: string | undefined, premiseId: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!hostId || !premiseId) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`visits-host-realtime-${hostId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `host_id=eq.${hostId}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [hostId, premiseId]);

    const query = React.useMemo(() => {
        if (!hostId || !premiseId) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'premise_id', operator: 'eq' as const, value: premiseId },
                { column: 'host_id', operator: 'eq' as const, value: hostId }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [hostId, premiseId, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

/**
 * Hook to fetch a user's single active visit.
 * Real-time enabled.
 * @param userId The ID of the user.
 */
export function useUserActiveVisit(userId: string | undefined) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!userId) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`user-active-visit-realtime-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `visitor_id=eq.${userId}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const query = React.useMemo(() => {
        if (!userId) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'visitor_id', operator: 'eq' as const, value: userId },
                { column: 'status', operator: 'eq' as const, value: 'active' }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: 1,
            __memo: true,
            __refresh: refreshKey
        };
    }, [userId, refreshKey]);

    const { data, isLoading, error } = useCollection<Visit>(query as any);
    return { data: data?.[0] || null, isLoading, error };
}

/**
 * Hook to fetch only ACTIVE visits for a specific premise.
 * Real-time enabled.
 */
export function useActiveVisitsForPremise(premiseId: string | undefined, pageSize: number = 50) {
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!premiseId) return;
        
        const supabase = createClient();
        const channel = supabase
            .channel(`active-visits-realtime-${premiseId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'visits',
                    filter: `premise_id=eq.${premiseId}`
                },
                () => {
                    setRefreshKey(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [premiseId]);

    const query = React.useMemo(() => {
        if (!premiseId) return null;
        return {
            table: 'visits',
            filters: [
                { column: 'premise_id', operator: 'eq' as const, value: premiseId },
                { column: 'status', operator: 'eq' as const, value: 'active' }
            ],
            orderBy: { column: 'checkin_time', ascending: false },
            limit: pageSize,
            __memo: true,
            __refresh: refreshKey
        };
    }, [premiseId, pageSize, refreshKey]);

    return useCollection<Visit>(query as any);
}

