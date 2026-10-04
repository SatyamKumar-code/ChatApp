const CACHE_NAME = "chatapp-shell-v2";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/favicon.svg",
    "/icons.svg",
    "/pwa-192x192.png",
    "/pwa-512x512.png",
    "/apple-touch-icon.png"
];

// Install: Cache core application shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn("Failed to pre-cache some assets during install:", err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-First for documents, Cache-First/Stale-While-Revalidate for assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // Bypass API and Socket requests completely
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
        return;
    }

    // Only handle GET requests
    if (event.request.method !== "GET") {
        return;
    }

    // Navigation requests (HTML pages)
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Update cache with latest HTML
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // When offline, serve cached index.html
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    return caches.match("/index.html") || caches.match("/");
                })
        );
        return;
    }

    // For static JS/CSS/Assets: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
