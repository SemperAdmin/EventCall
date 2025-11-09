/**
 * EventCall Service Worker
 * Provides offline support, caching, and performance optimization
 */

const CACHE_NAME = 'eventcall-v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles/main.css',
    '/styles/components.css',
    '/styles/responsive.css',
    '/styles/accessibility.css',
    '/styles/dashboard-v2.css',
    '/styles/event-management-v2.css',
    '/styles/invite.css',
    '/styles/login.css',
    '/js/error-handler.js',
    '/js/manager-system.js',
    '/js/event-manager.js',
    '/js/early-functions.js',
    '/js/ui-components.js',
    '/js/github-api.js',
    '/js/config.js',
    '/js/utils.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Always fetch JS from network to avoid stale code
    const isScript = request.destination === 'script' || url.pathname.endsWith('.js');
    if (isScript && request.method === 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // Handle SPA navigation - serve index.html for HTML page requests
    const isNavigationRequest = request.mode === 'navigate' ||
                                request.destination === 'document' ||
                                (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

    if (isNavigationRequest && request.method === 'GET') {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match('/index.html').then(cachedResponse => {
                    const networkFetch = fetch('/index.html').then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put('/index.html', networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);

                    return cachedResponse || networkFetch;
                });
            })
        );
        return;
    }

    // Static assets - cache first, network fallback
    if (request.method === 'GET') {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // Default to network
    event.respondWith(fetch(request));
});

/**
 * Cache first strategy - serve from cache, fall back to network
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function cacheFirstStrategy(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        if (cached) {
            // Check if cache is stale
            const cacheTime = await getCacheTimestamp(request.url);
            const now = Date.now();

            if (cacheTime && (now - cacheTime) < CACHE_DURATION) {
                console.log('[Service Worker] Serving from cache:', request.url);
                return cached;
            }
        }

        // Fetch from network
        console.log('[Service Worker] Fetching from network:', request.url);
        const response = await fetch(request);

        // Cache successful responses
        if (response && response.status === 200) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            await setCacheTimestamp(request.url, Date.now());
        }

        return response;

    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);

        // Try to serve from cache as fallback
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        if (cached) {
            console.log('[Service Worker] Serving stale cache:', request.url);
            return cached;
        }

        // Return offline page or error
        return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

/**
 * Network first strategy - fetch from network, fall back to cache
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);

        // Cache successful responses
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            const responseClone = response.clone();
            cache.put(request, responseClone);
            await setCacheTimestamp(request.url, Date.now());
        }

        return response;

    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);

        // Fall back to cache
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        if (cached) {
            console.log('[Service Worker] Serving from cache:', request.url);
            return cached;
        }

        throw error;
    }
}

/**
 * Get cache timestamp for a URL
 * @param {string} url - URL to check
 * @returns {Promise<number|null>} Timestamp or null
 */
async function getCacheTimestamp(url) {
    const cache = await caches.open(CACHE_NAME + '-timestamps');
    const response = await cache.match(url);

    if (response) {
        const text = await response.text();
        return parseInt(text, 10);
    }

    return null;
}

/**
 * Set cache timestamp for a URL
 * @param {string} url - URL to cache
 * @param {number} timestamp - Timestamp
 */
async function setCacheTimestamp(url, timestamp) {
    const cache = await caches.open(CACHE_NAME + '-timestamps');
    const response = new Response(timestamp.toString());
    await cache.put(url, response);
}

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        // Send response to prevent message channel from closing
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true, type: 'SKIP_WAITING' });
        }
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                ).then(() => {
                    // Send response after clearing cache
                    if (event.ports && event.ports[0]) {
                        event.ports[0].postMessage({ success: true, type: 'CLEAR_CACHE' });
                    }
                });
            })
        );
    }
});

console.log('[Service Worker] Script loaded');
