import React, { useEffect } from "react";
import { usePwa } from "../../context/PwaContext";

const PwaInstallBanner = () => {
    const {
        isInstalled,
        isBannerDismissed,
        os,
        deviceLabel,
        canPromptDirectly,
        triggerInstall,
        dismissBanner,
        openInstallModal,
    } = usePwa();

    useEffect(() => {
        // Mark first visit complete when user unmounts/navigates or leaves
        return () => {
            try {
                localStorage.setItem("chatapp_pwa_banner_seen", "true");
            } catch (e) {}
        };
    }, []);

    // If already installed as PWA or user has already visited before, do not show
    if (isInstalled || isBannerDismissed) {
        return null;
    }

    const isMobile = os === "android" || os === "ios";

    return (
        <div className="fixed bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-auto sm:right-4 z-40 max-w-md mx-auto sm:mx-0 animate-[fadeInUp_0.4s_ease-out]">
            <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl shadow-purple-950/60 text-white">
                {/* Top Glow Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />

                <div className="flex items-start gap-3">
                    {/* App Icon */}
                    <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden bg-slate-800 p-0.5 shadow-lg shadow-purple-600/30 border border-purple-500/30">
                            <img
                                src="/pwa-512x512.png"
                                alt="ChatApp Icon"
                                className="w-full h-full object-cover rounded-[14px]"
                            />
                        </div>
                    </div>

                    {/* Content tailored strictly for detected device */}
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-xs sm:text-sm text-white truncate">
                                Install ChatApp
                            </h4>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {deviceLabel}
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-300 line-clamp-2">
                            {isMobile
                                ? `Install ChatApp directly on your ${deviceLabel} for offline messaging & instant notifications.`
                                : `Install ChatApp on your ${deviceLabel} for desktop taskbar access and offline caching.`}
                        </p>

                        {/* Action Buttons strictly for detected device */}
                        <div className="mt-2.5 flex items-center gap-2">
                            <button
                                onClick={triggerInstall}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-purple-900/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.5}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                                {canPromptDirectly ? `Install on ${deviceLabel}` : "Install Guide"}
                            </button>

                            <button
                                onClick={openInstallModal}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs active:scale-95 transition-all cursor-pointer"
                            >
                                How to install
                            </button>
                        </div>
                    </div>

                    {/* Close / Dismiss Button */}
                    <button
                        onClick={dismissBanner}
                        aria-label="Dismiss banner"
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PwaInstallBanner;
