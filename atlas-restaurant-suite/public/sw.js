// Service Worker for offline support
const CACHE_NAME = 'atlas-house-v4';
const urlsToCache = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Don't fail if cache.addAll fails
        return cache.addAll(urlsToCache).catch(() => {
          // Silently fail in production
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  // Delete old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip service worker for WebSocket connections (wss://)
  if (url.protocol === 'wss:' || url.protocol === 'ws:') {
    return; // Let browser handle WebSocket connections normally
  }

  // Skip service worker for Vercel preview URLs and external domains
  if (url.hostname.includes('vercel.live') || url.hostname !== self.location.hostname) {
    return; // Let browser handle it normally
  }

  // Skip service worker for Supabase real-time connections
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/realtime/')) {
    return; // Let browser handle Supabase real-time connections normally
  }

  // For assets (JS, CSS, images), use network-first strategy with better error handling
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }) // Always fetch fresh
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {
                // Silently fail in production
              });
            }).catch(() => {
              // Silently fail in production
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache, return error response
            return new Response('Network error and no cache available', {
              status: 408,
              statusText: 'Request Timeout',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  // For HTML pages, use network-first with cache fallback
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // Cache successful HTML responses
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {
                // Silently fail in production
              });
            }).catch(() => {
              // Silently fail in production
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to index.html for SPA routing
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For other requests, try network first, don't intercept if it fails
  event.respondWith(
    fetch(request).catch(() => {
      // Return a proper error response instead of failing silently
      return new Response('Network error', {
        status: 408,
        statusText: 'Request Timeout',
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
