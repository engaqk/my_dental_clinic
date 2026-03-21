const CACHE_NAME = 'dental-clinic-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/db-api.js',
    '/auth.js',
    '/phoneUtils.js',
    '/theme-switcher.js'
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
            return response || fetch(event.request);
        })
    );
});
