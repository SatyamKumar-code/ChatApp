import api from "./api";

/**
 * Convert VAPID public key from URL-safe base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Check if the current browser environment supports Service Worker Web Push
 */
export const isPushSupported = () => {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
};

/**
 * Get current browser notification permission
 * @returns {'default' | 'granted' | 'denied' | 'unsupported'}
 */
export const getNotificationPermission = () => {
    if (!isPushSupported()) return "unsupported";
    return Notification.permission;
};

/**
 * Check if the current device has an active push subscription with the browser
 */
export const getActiveSubscription = async () => {
    if (!isPushSupported()) return null;
    try {
        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    } catch (err) {
        console.warn("[PushService] Failed to get existing subscription:", err);
        return null;
    }
};

/**
 * Subscribe user to Web Push notifications with VAPID
 */
export const subscribeToPush = async () => {
    if (!isPushSupported()) {
        throw new Error("Push notifications are not supported in this browser.");
    }

    // 1. Request notification permission from user
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error(
            permission === "denied"
                ? "Notification permission was blocked in browser settings."
                : "Notification permission was dismissed."
        );
    }

    // 2. Fetch VAPID public key from backend
    const vapidRes = await api.get("/push/vapid-public-key");
    const publicKey = vapidRes.data?.publicKey;
    if (!publicKey) {
        throw new Error("Server failed to provide VAPID public key.");
    }

    // 3. Ensure Service Worker is ready
    const registration = await navigator.serviceWorker.ready;

    // 4. Check for existing subscription or create a new one
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
        });
    }

    const subJson = subscription.toJSON();

    // 5. Register subscription with ChatApp backend
    const deviceInfo = `${navigator.platform || ""} • ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"}`;
    await api.post("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
        },
        userAgent: navigator.userAgent,
        deviceInfo,
    });

    try {
        localStorage.setItem("chatapp_push_enabled", "true");
    } catch (e) {}

    return {
        success: true,
        subscription,
    };
};

/**
 * Unsubscribe user from Web Push notifications
 */
export const unsubscribeFromPush = async () => {
    if (!isPushSupported()) return { success: true };

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Inform backend to remove subscription from database
            await api
                .post("/push/unsubscribe", {
                    endpoint: subscription.endpoint,
                })
                .catch((e) => console.warn("Backend unsubscribe warning:", e));

            // Unsubscribe in browser push manager
            await subscription.unsubscribe();
        }

        try {
            localStorage.setItem("chatapp_push_enabled", "false");
        } catch (e) {}

        return { success: true };
    } catch (err) {
        console.error("[PushService] Unsubscribe error:", err);
        throw err;
    }
};

/**
 * Send a test notification to verify push delivery to this device via backend
 */
export const testPushNotification = async () => {
    const res = await api.post("/push/test");
    return res.data;
};

/**
 * Trigger an immediate local OS notification via Service Worker
 * (Helps instantly verify if Windows/OS has silenced notifications or enabled Focus Assist)
 */
export const testLocalNotification = async () => {
    if (!isPushSupported()) {
        throw new Error("Notifications are not supported in this browser.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error("Notification permission is not granted (" + permission + ").");
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("ChatApp (OS Toast Test)", {
        body: "Windows OS notification is working! If you see this, background message & call alerts will appear here.",
        icon: "/pwa-192x192.png",
        tag: "test-local-toast",
    });
    return { success: true };
};

/**
 * Automatically sync subscription on app boot or login if permission is already granted
 */
export const syncPushSubscriptionIfGranted = async () => {
    if (!isPushSupported()) return;
    if (Notification.permission === "granted" && localStorage.getItem("chatapp_push_enabled") !== "false") {
        try {
            await subscribeToPush();
        } catch (err) {
            console.debug("[PushService] Background sync error:", err);
        }
    }
};

/**
 * Trigger an OS-level notification on the device (desktop / mobile)
 * Works via ServiceWorker registration or standard Web Notification API
 */
export const showNativeOSNotification = async ({
    title,
    body,
    icon,
    tag,
    conversationId,
    messageId,
}) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const defaultIcon = "/pwa-192x192.png";
    const safeIcon =
        icon && (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("data:"))
            ? icon
            : defaultIcon;

    const notifTag =
        tag ||
        `msg-${messageId || `${conversationId || "conv"}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`}`;

    const options = {
        body: body || "New message received",
        icon: safeIcon,
        badge: defaultIcon,
        tag: notifTag,
        renotify: true,
        vibrate: [150, 80, 150],
        data: {
            type: "MESSAGE",
            conversationId: conversationId || "",
            messageId: messageId || "",
            url: conversationId ? `/?conversationId=${conversationId}` : "/",
        },
        actions: [{ action: "open", title: "Open Chat 💬" }],
    };

    // 1. Try Service Worker registration first (standard for PWAs and OS integration)
    try {
        if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title || "ChatApp", options);
                return;
            }
        }
    } catch (swErr) {
        console.warn("[PushService] SW showNotification failed, trying Notification constructor:", swErr);
    }

    // 2. Fallback to standard Window Notification
    try {
        const notif = new Notification(title || "ChatApp", options);
        notif.onclick = () => {
            window.focus();
            if (options.data?.url) {
                window.location.href = options.data.url;
            }
        };
    } catch (notifErr) {
        console.warn("[PushService] Native Notification constructor failed:", notifErr);
    }
};
