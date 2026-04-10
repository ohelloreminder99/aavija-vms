const CACHE_NAME = 'aavija-v1';

// Assets to eagerly cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-icon.png',
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

// Network-First strategy with Fallback to Cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests, API calls, and Supabase traffic
  if (
    event.request.method !== 'GET' ||
    !url.href.startsWith(self.location.origin) ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('supabase')
  ) {
    return;
  }

  // Strategy: Network-First
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we get a valid response, clone it into the cache for next time
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache if network is down
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigation requests, always return root if offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }

        return new Response('Offline - Network error', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
