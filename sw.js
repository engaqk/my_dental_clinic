/**
 * sw.js - Service Worker for Dental Clinic PWA
 * Version: v45.4.0
 * Features: Instant auto-update, Network-First strategy for fresh deployments, offline fallback.
 */

const CACHE_NAME = 'dental-clinic-v45-4';

const ASSETS = [
    './',
    'index.html',
    'superadmin.html',
    'style.css',
    'script.js',
    'emailTemplates.js',
    'premium-features.js',
    'translations.js',
    'db-api.js',
    'auth.js',
    'phoneUtils.js',
    'theme-switcher.js',
    'logo.png',
    'logo-blue.png',
    'logo-green.png',
    'favicon.ico',
    'app-icon.png',
    'manifest.webmanifest'
];

// Install: Cache core assets and skip waiting immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('SW: Non-critical asset cache warning:', err);
            });
        })
    );
});

// Activate: Delete old caches and take control of all open pages immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log('SW: Purging old cache:', key);
                    return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim()).then(() => {
            // Notify all open client windows and PWAs that a new version is active
            return self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SW_VERSION_UPDATED', version: CACHE_NAME });
                });
            });
        })
    );
});

// Fetch: Network-First for HTML and scripts so users ALWAYS receive the latest deployment
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // 1. Never intercept non-GET, API calls, or version.json check
    if (event.request.method !== 'GET' || url.includes('/api/') || url.includes('version.json') || url.includes('identitytoolkit') || url.includes('googleapis.com')) {
        return;
    }

    // 2. Bypass manifest to avoid browser authentication/CORS issues
    if (url.includes('manifest.webmanifest')) {
        return;
    }

    // 3. Network-First Strategy for Navigation (HTML) and Core JS/CSS
    const isNavigation = event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/');
    const isCodeAsset = url.endsWith('.js') || url.endsWith('.css');

    if (isNavigation || isCodeAsset) {
        event.respondWith(
            fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Network unavailable -> fallback to offline cache
                return caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    if (isNavigation) return caches.match('index.html');
                });
            })
        );
        return;
    }

    // 4. Stale-While-Revalidate for images & static assets
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
