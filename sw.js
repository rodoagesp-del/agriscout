const CACHE_NAME = 'agriscout-cache-v2'; // v2 para forzar la actualización
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './js/data.js',
    './js/ui.js',
    './js/map.js',
    './js/config.js',
    './js/evaluation.js',
    './js/reports.js',
    './js/main.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});