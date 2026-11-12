// Service worker: makes the site installable and lets it open offline.
// Bump VERSION when shell files change so old caches are cleared.
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const ASSET_LIMIT = 200; // logos, headshots, fonts

const SHELL = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
    'icons/favicon-32.png'
];

// Live data: never cached, the app shows its own error/sample state offline
const LIVE_HOSTS = ['workers.dev', 'espn.com'];
// Static third-party files worth keeping
const ASSET_HOSTS = ['a.espncdn.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE)
                .map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    } else if (ASSET_HOSTS.some(h => url.hostname === h)) {
        event.respondWith(cacheFirst(request));
    } else if (LIVE_HOSTS.some(h => url.hostname.endsWith(h))) {
        return; // straight to network
    }
});

// App files: fresh when online, cached copy when offline
async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request, { ignoreSearch: true })
            || (request.mode === 'navigate' && await cache.match('index.html'));
        if (cached) return cached;
        throw err;
    }
}

// Images and fonts rarely change: serve from cache, fetch once
async function cacheFirst(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone());
        trimCache(cache);
    }
    return response;
}

async function trimCache(cache) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - ASSET_LIMIT; i++) await cache.delete(keys[i]);
}
