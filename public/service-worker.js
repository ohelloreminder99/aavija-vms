// A unique name for our cache
const CACHE_NAME = 'aavija-pwa-cache-v1';

// The list of files we want to cache
const urlsToCache = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-icon.png',
  // You can add more critical assets here like your logo or key CSS files
];

// Install event: opens the cache and adds our core files to it.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event: cleans up old caches.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// Fetch event: This is crucial for PWA installability and offline support.
// It implements a "cache-first, then network" strategy.
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  // For navigation requests (e.g., loading a page), always try the network first
  // to get the freshest content, but fall back to the cache if offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request)
        .then((response) => {
          // If we have a match in the cache, return it.
          if (response) {
            return response;
          }

          // Otherwise, fetch from the network.
          return fetch(event.request).then((networkResponse) => {
            // OPTIONAL: If you want to cache dynamically fetched assets (like images or API calls),
            // you can clone the response and put it in the cache here.
            // Be careful with this, especially for frequently changing data.
            // For example, to cache images:
            // if (event.request.destination === 'image') {
            //   cache.put(event.request, networkResponse.clone());
            // }
            
            return networkResponse;
          });
        });
    })
  );
});
