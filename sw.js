const CACHE_NAME = 'dental-clinic-v1';
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'script.js',
    'db-api.js',
    'auth.js',
    'phoneUtils.js',
    'theme-switcher.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // FORCE CLENT RELOAD ON NEW PUSH
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // If the request is for an API path, do not cache it, just fetch from network
            if (event.request.url.includes('/api/')) {
                return fetch(event.request);
            }
            return response || fetch(event.request);
        })
    );
});
