'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getPendingCheckins, removePendingCheckin } from '@/lib/offline-store';
import { finalizeCheckin } from '@/app/dashboard/gatekeeper/actions';

export function ServiceWorkerRegistration() {
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/service-worker.js').then(
                    function (registration) {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    function (err) {
                        console.log('ServiceWorker registration failed: ', err);
                    }
                );
            });
        }
    }, []);

    useEffect(() => {
        // Listen for coming back online to sync offline queue
        const handleOnline = async () => {
            console.log('Network is back online. Checking for pending checkins...');
            const queue = await getPendingCheckins();

            if (queue.length > 0) {
                toast({
                    title: 'Syncing Offline SCans',
                    description: `Attempting to sync ${queue.length} offline check-ins...`,
                });

                let successCount = 0;
                let failCount = 0;

                for (const item of queue) {
                    try {
                        const result = await finalizeCheckin({
                            token: item.token,
                            visitor_id: item.visitor_id,
                            host_id: item.host_id,
                            premise_id: item.premise_id,
                            gatekeeperId: item.gatekeeperId,
                        });

                        if (result.success) {
                            await removePendingCheckin(item.id);
                            successCount++;
                        } else {
                            console.error("Sync failed for item:", item, result.error);
                            failCount++;
                        }
                    } catch (e) {
                        console.error("Sync error:", e);
                        failCount++;
                    }
                }

                toast({
                    title: 'Sync Complete',
                    description: `Successfully synced ${successCount} scans. ${failCount > 0 ? `Failed: ${failCount}.` : ''}`,
                    variant: failCount > 0 ? 'destructive' : 'default',
                });
            }
        };

        window.addEventListener('online', handleOnline);

        // Also try to sync occasionally or on mount if we're online
        if (navigator.onLine) {
            handleOnline();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [toast]);

    return null;
}
