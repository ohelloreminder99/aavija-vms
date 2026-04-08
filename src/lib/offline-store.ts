import { set, get, del, keys } from 'idb-keyval';
import { SerializableCheckinHost } from '@/app/dashboard/gatekeeper/actions';

const CACHE_KEY_PREFIX = 'aavija:hosts:';
const QUEUE_KEY_PREFIX = 'aavija:offline_queue:';

export type OfflineCheckinPayload = {
    id: string; // unique ID for the queue item
    token: string;
    premise_id: string;
    host_id: string;
    gatekeeperId: string;
    visitor_id: string; // we need this to finalize checkin offline
    timestamp: number;
};

// --- HOSTS CACHING ---
export async function saveCachedHosts(premise_id: string, hosts: SerializableCheckinHost[]): Promise<void> {
    const key = `${CACHE_KEY_PREFIX}${premiseId}`;
    await set(key, hosts);
}

export async function getCachedHosts(premise_id: string): Promise<SerializableCheckinHost[] | null> {
    const key = `${CACHE_KEY_PREFIX}${premiseId}`;
    return await get<SerializableCheckinHost[]>(key) || null;
}

// --- OFFLINE QUEUE ---
export async function queueOfflineCheckin(payload: OfflineCheckinPayload): Promise<void> {
    const key = `${QUEUE_KEY_PREFIX}${payload.id}`;
    await set(key, payload);
}

export async function getPendingCheckins(): Promise<OfflineCheckinPayload[]> {
    const allKeys = await keys();
    const queueKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(QUEUE_KEY_PREFIX)) as string[];

    const pending: OfflineCheckinPayload[] = [];
    for (const key of queueKeys) {
        const item = await get<OfflineCheckinPayload>(key);
        if (item) pending.push(item);
    }

    // Return sorted by timestamp (oldest first)
    return pending.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removePendingCheckin(id: string): Promise<void> {
    const key = `${QUEUE_KEY_PREFIX}${id}`;
    await del(key);
}
