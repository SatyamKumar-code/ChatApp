import React, { useState, useEffect } from "react";
import { getDevicePlatform, isStandaloneMode } from "../../utils/deviceDetect";

const MobileAppDownloadBanner = () => {
    const [platform, setPlatform] = useState("desktop");
    const [isDismissed, setIsDismissed] = useState(false);
    const [showIOSModal, setShowIOSModal] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        // Strict check: if running as installed standalone app, don't show download prompt
        if (isStandaloneMode()) {
            return;
        }

        const detectedPlatform = getDevicePlatform();
        setPlatform(detectedPlatform);

        // Check if user previously dismissed banner for this session
        const dismissed = sessionStorage.getItem("chatapp_dismiss_app_banner");
        if (dismissed === "true") {
            setIsDismissed(true);
        }

        // Capture Android/PWA install prompt if supported by browser
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        };
    }, []);

    // Strict requirement: If desktop, NEVER show download option
    if (platform === "desktop" || isDismissed) {
        return null;
    }

    const handleDismiss = () => {
        setIsDismissed(true);
        sessionStorage.setItem("chatapp_dismiss_app_banner", "true");
    };

    const handleAndroidDownload = () => {
        setIsDownloading(true);
        // Trigger APK download
        const link = document.createElement("a");
        link.href = "/downloads/ChatApp.apk";
        link.download = "ChatApp.apk";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            setIsDownloading(false);
        }, 2000);
    };

    const handlePWAInstall = async () => {
        if (!deferredPrompt) {
            handleAndroidDownload();
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setIsDismissed(true);
        }
        setDeferredPrompt(null);
    };

    return (
        <>
            {/* Banner Container - Mobile only */}
            <div className="fixed bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-auto sm:right-4 z-40 max-w-md mx-auto sm:mx-0 animate-[fadeInUp_0.4s_ease-out]">
                <div className="relative overflow-hidden rounded-2xl p-4 bg-slate-900/90 backdrop-blur-xl border border-purple-500/30 shadow-2xl shadow-purple-950/50 text-white">
                    {/* Top Glow Accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />

                    <div className="flex items-start gap-3">
                        {/* App Icon with Badge */}
                        <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 p-0.5 shadow-lg shadow-purple-600/30 border border-purple-500/30">
                                <img
                                    src="/pwa-512x512.png"
                                    alt="ChatApp Icon"
                                    className="w-full h-full object-cover rounded-[14px]"
                                />
                            </div>
                        </div>

                        {/* Text Information */}
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-semibold text-sm text-white truncate">
                                    {platform === "android" ? "ChatApp for Android" : "ChatApp for iOS"}
                                </h4>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/30">
                                    {platform === "android" ? "APK" : "App"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2">
                                {platform === "android"
                                    ? "Download Android APK with full offline mode and instant messaging."
                                    : "Install ChatApp on your iPhone with offline storage & full screen mode."}
                            </p>

                            {/* Buttons */}
                            <div className="mt-3 flex items-center gap-2">
                                {platform === "android" ? (
                                    <>
                                        <button
                                            onClick={handleAndroidDownload}
                                            disabled={isDownloading}
                                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-900/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            {isDownloading ? "Downloading..." : "Download APK"}
                                        </button>

                                        {deferredPrompt && (
                                            <button
                                                onClick={handlePWAInstall}
                                                className="px-3 py-1.5 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/40 text-purple-200 font-medium text-xs active:scale-95 transition-all cursor-pointer"
                                            >
                                                Install PWA
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setShowIOSModal(true)}
                                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-purple-900/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Install on iOS
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Close / Dismiss Button */}
                        <button
                            onClick={handleDismiss}
                            aria-label="Dismiss"
                            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* iOS Instructions Modal */}
            {showIOSModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-white relative">
                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 p-0.5 shadow-lg shadow-purple-600/30 border border-purple-500/30 flex-shrink-0">
                                <img
                                    src="/pwa-512x512.png"
                                    alt="ChatApp Icon"
                                    className="w-full h-full object-cover rounded-[14px]"
                                />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Install on iPhone</h3>
                                <p className="text-xs text-slate-400">Offline ChatApp Experience</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-sm text-slate-300 my-4">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    1
                                </div>
                                <p className="text-xs">
                                    Open this website in <span className="font-semibold text-white">Safari</span> and tap the <span className="font-semibold text-white">Share button</span> (square with arrow up at the bottom).
                                </p>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    2
                                </div>
                                <p className="text-xs">
                                    Scroll down and select <span className="font-semibold text-white">"Add to Home Screen"</span> (<span className="text-purple-400">+</span>).
                                </p>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    3
                                </div>
                                <p className="text-xs">
                                    Tap <span className="font-semibold text-white">"Add"</span> in the top right corner. The ChatApp will be installed on your home screen with offline capability!
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSModal(false)}
                            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-medium text-sm transition-all shadow-lg shadow-purple-900/30 cursor-pointer"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileAppDownloadBanner;
