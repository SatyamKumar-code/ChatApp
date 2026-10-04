import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getOS, getBrowserName, isStandaloneMode, getDeviceLabel } from "../utils/deviceDetect";

const PwaContext = createContext();

export const PwaProvider = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [os, setOs] = useState("desktop");
    const [browser, setBrowser] = useState("browser");
    const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem("chatapp_pwa_banner_seen") === "true";
    });

    useEffect(() => {
        // Initial detection
        setIsInstalled(isStandaloneMode());
        setOs(getOS());
        setBrowser(getBrowserName());

        // Capture PWA install prompt event
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        // App installed event
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            try {
                localStorage.setItem("chatapp_pwa_installed", "true");
                localStorage.setItem("chatapp_pwa_banner_seen", "true");
            } catch (e) {}
            setIsBannerDismissed(true);
        };

        // Media query listener for display-mode changes
        const mediaQuery = window.matchMedia("(display-mode: standalone)");
        const handleDisplayModeChange = (e) => {
            if (e.matches) {
                setIsInstalled(true);
            }
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.addEventListener("appinstalled", handleAppInstalled);
        if (mediaQuery?.addEventListener) {
            mediaQuery.addEventListener("change", handleDisplayModeChange);
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalled);
            if (mediaQuery?.removeEventListener) {
                mediaQuery.removeEventListener("change", handleDisplayModeChange);
            }
        };
    }, []);

    // Trigger installation
    const triggerInstall = useCallback(async () => {
        if (deferredPrompt) {
            try {
                await deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === "accepted") {
                    setIsInstalled(true);
                    setDeferredPrompt(null);
                    try {
                        localStorage.setItem("chatapp_pwa_installed", "true");
                        localStorage.setItem("chatapp_pwa_banner_seen", "true");
                    } catch (e) {}
                    setIsBannerDismissed(true);
                    return true;
                }
                setDeferredPrompt(null);
                return false;
            } catch (err) {
                console.error("Install prompt error:", err);
                setShowInstallModal(true);
                return false;
            }
        } else {
            // No direct prompt available (iOS Safari, or browser already handled it) -> Show guided instructions modal
            setShowInstallModal(true);
            return false;
        }
    }, [deferredPrompt]);

    const dismissBanner = useCallback(() => {
        setIsBannerDismissed(true);
        try {
            localStorage.setItem("chatapp_pwa_banner_seen", "true");
        } catch (e) {}
    }, []);

    const openInstallModal = useCallback(() => {
        setShowInstallModal(true);
    }, []);

    const closeInstallModal = useCallback(() => {
        setShowInstallModal(false);
    }, []);

    return (
        <PwaContext.Provider
            value={{
                isInstalled,
                canPromptDirectly: !!deferredPrompt,
                os,
                deviceLabel: getDeviceLabel(os),
                browser,
                isBannerDismissed,
                showInstallModal,
                triggerInstall,
                dismissBanner,
                openInstallModal,
                closeInstallModal,
            }}
        >
            {children}
        </PwaContext.Provider>
    );
};

export const usePwa = () => {
    const context = useContext(PwaContext);
    if (!context) {
        throw new Error("usePwa must be used within a PwaProvider");
    }
    return context;
};

export default PwaContext;
