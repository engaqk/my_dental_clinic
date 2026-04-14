const CACHE_NAME = 'dental-clinic-v2'; // Incremented version
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'script.js',
    'db-api.js',
    'auth.js',
    'phoneUtils.js',
    'theme-switcher.js',
    'logo.png',
    'manifest.webmanifest',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
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
        })
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
