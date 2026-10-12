const CACHE_NAME = 'dental-clinic-v33'; // Force reload for dashboard card sizes and SCHEDULE text
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'script.js',
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
    'manifest.webmanifest',
    'screenshot-home.png',
    'screenshot-services.png',
    'screenshot-dashboard.png',
    'screenshot-profile.png',
    'screenshot-bill.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(err => {
                console.warn('SW: Some assets failed to cache during install:', err);
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // 1. Do not intercept non-GET requests or API calls
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // 2. Bypass Service Worker for manifest.webmanifest to avoid 401/CORS issues with some providers
    if (event.request.url.includes('manifest.webmanifest')) {
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(event.request).catch(() => {
                // If both fail and it's a page request, maybe show a custom offline page
                if (event.request.mode === 'navigate') {
                    return caches.match('./');
                }
            });
        })
    );
});
