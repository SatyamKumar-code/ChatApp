/**
 * Detects the user's platform: 'android' | 'ios' | 'desktop'
 * Strictly guarantees that desktop browsers return 'desktop'.
 */
export const getDevicePlatform = (customUa = null) => {
    const ua = (
        customUa ||
        (typeof navigator !== "undefined"
            ? (navigator.userAgent || navigator.vendor || (typeof window !== "undefined" ? window.opera : "")) || ""
            : "")
    ).toLowerCase();

    // Check if running on Android mobile/tablet
    if (/android/i.test(ua)) {
        return "android";
    }

    // Check if running on iOS (iPhone, iPad, iPod)
    // Note: iPadOS 13+ reports MacIntel but has touch points > 1
    const isIOS =
        /iphone|ipad|ipod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
        return "ios";
    }

    // Fallback check: if any other mobile user agent
    if (/mobi|opera mini|blackberry|iemobile/i.test(ua)) {
        return "android";
    }

    // Default to Desktop (Windows, macOS, Linux, etc.)
    return "desktop";
};

/**
 * Checks if the app is already running in standalone / PWA installed mode
 */
export const isStandaloneMode = () => {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://")
    );
};
