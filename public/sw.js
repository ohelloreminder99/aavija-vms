const CACHE_NAME = 'aavija-v1';

// Assets to eagerly cache on install (optional, we use network-first mostly)
const PRECACHE_URLS = [
    '/',
    '/offline.html',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Network-First strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip cross-origin requests, API calls to Supabase, and non-GET requests
    if (
        event.request.method !== 'GET' ||
        !url.href.startsWith(self.location.origin) ||
        url.pathname.startsWith('/api/') ||
        url.pathname.includes('/supabase/') // Depending on how you proxy or hit supabase
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Only cache valid OK responses
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(async () => {
                // If network fails, try the cache
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Return a fallback page if navigating
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }

                return new Response('Network error happened', {
                    status: 408,
                    headers: { 'Content-Type': 'text/plain' },
                });
            })
    );
});
