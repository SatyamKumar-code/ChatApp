const CACHE_NAME = "chatapp-shell-v6";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/favicon.svg",
    "/favicon.png",
    "/icons.svg",
    "/pwa-192x192.png",
    "/pwa-512x512.png",
    "/apple-touch-icon.png",
];

// Install: Cache core application shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn("[SW] Failed to pre-cache some assets during install:", err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch: Network-First for documents, Cache-First for assets, bypass API & Socket
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
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(async () => {
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

// =========================================================================
// WEB PUSH NOTIFICATIONS (Works even when PWA is completely closed)
// =========================================================================

self.addEventListener("push", (event) => {
    if (!event.data) {
        console.warn("[SW] Push received but has no data");
        return;
    }

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        payload = { type: "MESSAGE", body: event.data.text(), senderName: "ChatApp" };
    }

    const { type } = payload;
    const defaultIcon = new URL("/pwa-192x192.png", self.registration.scope).href;
    const defaultBadge = new URL("/pwa-192x192.png", self.registration.scope).href;

    event.waitUntil(
        (async () => {
            // Check existing open windows to avoid duplicate alerts when user is actively focused
            const windowClients = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });

            // Handle INCOMING AUDIO or VIDEO CALL
            if (type === "AUDIO_CALL" || type === "VIDEO_CALL") {
                const isVideo = payload.callType === "video" || type === "VIDEO_CALL";
                const callerName = payload.callerName || "Unknown Caller";
                const title = isVideo ? `📹 Incoming Video Call` : `📞 Incoming Audio Call`;
                const body = `${callerName} is calling you...`;

                const safeIcon = (payload.callerAvatar && (payload.callerAvatar.startsWith("http://") || payload.callerAvatar.startsWith("https://")))
                    ? payload.callerAvatar
                    : defaultIcon;

                const callNotificationOptions = {
                    body,
                    icon: safeIcon,
                    badge: defaultBadge,
                    tag: `call-${payload.callId || payload.callerId || "call"}`,
                    renotify: true,
                    requireInteraction: true, // Keep notification pinned on screen until user responds
                    vibrate: [400, 200, 400, 200, 400, 400, 800, 400],
                    data: {
                        type: "CALL",
                        callType: isVideo ? "video" : "audio",
                        callId: payload.callId || "",
                        callerId: payload.callerId || "",
                        callerName,
                        callerAvatar: safeIcon,
                        callerPhone: payload.callerPhone || "",
                        conversationId: payload.conversationId || "",
                        url: `/?callAction=accept&callerId=${payload.callerId || ""}&callType=${isVideo ? "video" : "audio"}&callId=${payload.callId || ""}&callerName=${encodeURIComponent(callerName)}`,
                    },
                    actions: [
                        { action: "accept", title: "Accept 📞" },
                        { action: "reject", title: "Decline ❌" },
                    ],
                };

                // Notify all open window clients if any exist
                windowClients.forEach((client) => {
                    client.postMessage({
                        type: "INCOMING_CALL_PUSH",
                        payload,
                    });
                });

                try {
                    return await self.registration.showNotification(title, callNotificationOptions);
                } catch (callErr) {
                    console.warn("[SW] Advanced call notification failed, showing basic fallback:", callErr);
                    return await self.registration.showNotification(title, {
                        body,
                        icon: defaultIcon,
                        tag: `call-${payload.callId || payload.callerId || "call"}`,
                        requireInteraction: true,
                    });
                }
            }

            // Handle CHAT MESSAGE
            if (type === "MESSAGE") {
                // Deduplication: Only suppress if user is actively in this conversation in the foreground
                const isActivelyChatting = windowClients.some((client) => {
                    return (
                        client.focused &&
                        client.visibilityState === "visible" &&
                        client.url &&
                        payload.conversationId &&
                        client.url.includes(payload.conversationId)
                    );
                });

                if (isActivelyChatting) {
                    console.log("[SW] Push banner suppressed: User already has conversation focused.");
                    return;
                }

                const title = payload.isGroup
                    ? `${payload.conversationName || "Group"} • ${payload.senderName || "ChatApp"}`
                    : payload.senderName || "ChatApp";

                const safeIcon = (payload.senderAvatar && (payload.senderAvatar.startsWith("http://") || payload.senderAvatar.startsWith("https://")))
                    ? payload.senderAvatar
                    : defaultIcon;

                const messageNotificationOptions = {
                    body: payload.body || "New message received",
                    icon: safeIcon,
                    badge: defaultBadge,
                    tag: `msg-${payload.conversationId || "general"}`,
                    renotify: true,
                    vibrate: [150, 80, 150],
                    data: {
                        type: "MESSAGE",
                        conversationId: payload.conversationId || "",
                        senderId: payload.senderId || "",
                        messageId: payload.messageId || "",
                        url: payload.conversationId ? `/?conversationId=${payload.conversationId}` : "/",
                    },
                    actions: [{ action: "open", title: "Open Chat 💬" }],
                };

                // Forward to open clients for in-app toast/counter sync
                windowClients.forEach((client) => {
                    client.postMessage({
                        type: "NEW_MESSAGE_PUSH",
                        payload,
                    });
                });

                try {
                    return await self.registration.showNotification(title, messageNotificationOptions);
                } catch (notifErr) {
                    console.warn("[SW] Advanced message notification failed, showing basic fallback:", notifErr);
                    return await self.registration.showNotification(title, {
                        body: payload.body || "New message received",
                        icon: defaultIcon,
                        tag: `msg-${payload.conversationId || "general"}`,
                    });
                }
            }
        })()
    );
});

// =========================================================================
// NOTIFICATION CLICK & ACTION HANDLING
// =========================================================================

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const notifData = event.notification.data || {};
    const action = event.action;

    // Handle Call Reject Action
    if (action === "reject") {
        event.waitUntil(
            fetch("/api/push/call-reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    callerId: notifData.callerId,
                    callId: notifData.callId,
                }),
                credentials: "include",
            }).catch((err) => {
                console.error("[SW] Error declining call via push endpoint:", err);
            })
        );
        return;
    }

    // Default or Accept Action: Open / Focus ChatApp Window
    const targetUrl = notifData.url || "/";

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                // Check if any ChatApp window is already open
                for (const client of clientList) {
                    if ("focus" in client) {
                        client.focus();
                        client.postMessage({
                            type: "NOTIFICATION_CLICKED",
                            data: notifData,
                            action,
                        });
                        if (notifData.url && client.navigate) {
                            return client.navigate(notifData.url);
                        }
                        return client;
                    }
                }

                // If completely closed, launch fresh PWA window to target URL
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});

// Handle Notification Close Event
self.addEventListener("notificationclose", (event) => {
    console.log("[SW] Notification closed by user:", event.notification.tag);
});
