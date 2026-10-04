/**
 * Robust Device, OS, Browser, and PWA Mode Detection
 */

export const getOS = () => {
    if (typeof window === "undefined" || !navigator) return "windows";
    const ua = (navigator.userAgent || navigator.vendor || window.opera || "").toLowerCase();
    const platform = (navigator.platform || "").toLowerCase();

    // Check iOS first (iPhone, iPad, iPod, iPadOS)
    const isIOS =
        /iphone|ipad|ipod/i.test(ua) ||
        (platform === "macintel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);
    if (isIOS) return "ios";

    // Android
    if (/android/i.test(ua)) return "android";

    // Windows PC
    if (/win/i.test(platform) || /windows/i.test(ua)) return "windows";

    // Mac
    if (/mac/i.test(platform) || /macintosh/i.test(ua)) return "mac";

    // Linux
    if (/linux/i.test(platform) || /linux/i.test(ua)) return "linux";

    return "desktop";
};

export const getDeviceLabel = (os = null) => {
    const detected = os || getOS();
    switch (detected) {
        case "windows":
            return "Windows PC";
        case "mac":
            return "Mac";
        case "android":
            return "Android";
        case "ios":
            return "iPhone / iPad";
        case "linux":
            return "Linux PC";
        default:
            return "PC / Desktop";
    }
};

export const getDevicePlatform = (customUa = null) => {
    return getOS();
};

export const getBrowserName = () => {
    if (typeof window === "undefined" || !navigator) return "browser";
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes("edg/")) return "edge";
    if (ua.includes("opr/") || ua.includes("opera/")) return "opera";
    if (ua.includes("chrome") && !ua.includes("edg/")) return "chrome";
    if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
    if (ua.includes("firefox")) return "firefox";
    return "browser";
};

export const isStandaloneMode = () => {
    if (typeof window === "undefined") return false;
    const isParam = typeof window.location !== "undefined" && window.location.search.includes("source=pwa");
    const isDisplayMode = Boolean(
        window.matchMedia && (
            window.matchMedia("(display-mode: standalone)").matches ||
            window.matchMedia("(display-mode: window-controls-overlay)").matches ||
            window.matchMedia("(display-mode: minimal-ui)").matches
        )
    );
    const isNavStandalone = typeof navigator !== "undefined" && window.navigator.standalone === true;
    const isReferrer = typeof document !== "undefined" && document.referrer.includes("android-app://");
    const isLocalMark = typeof localStorage !== "undefined" && localStorage.getItem("chatapp_pwa_installed") === "true";

    const isInstalled = Boolean(isParam || isDisplayMode || isNavStandalone || isReferrer || isLocalMark);
    if (isInstalled && typeof localStorage !== "undefined") {
        try {
            localStorage.setItem("chatapp_pwa_installed", "true");
        } catch (e) {}
    }
    return isInstalled;
};
