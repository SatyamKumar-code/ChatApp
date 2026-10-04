import React from "react";
import { usePwa } from "../../context/PwaContext";

const PwaInstallModal = () => {
    const { isInstalled, showInstallModal, closeInstallModal, os, deviceLabel, canPromptDirectly, triggerInstall, browser } = usePwa();

    if (!showInstallModal || isInstalled) return null;

    return (
        <div
            onClick={closeInstallModal}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#121224] border border-purple-500/30 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl text-white relative overflow-hidden"
            >
                {/* Background decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 p-1 shadow-lg shadow-purple-600/30 border border-purple-500/30 flex-shrink-0">
                        <img
                            src="/pwa-512x512.png"
                            alt="ChatApp Icon"
                            className="w-full h-full object-cover rounded-[12px]"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg sm:text-xl text-white">Install ChatApp</h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                PWA
                            </span>
                        </div>
                        <p className="text-xs text-purple-300 font-medium mt-0.5 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            Detected Device: <strong className="text-white">{deviceLabel}</strong>
                        </p>
                    </div>
                </div>

                {/* Direct 1-Click Install Button if supported by browser */}
                {canPromptDirectly && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-purple-600/20 border border-purple-500/40 relative z-10">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-200">
                                <span className="font-semibold text-white block mb-0.5">Direct Install Ready</span>
                                Click to download & install ChatApp on your {deviceLabel}.
                            </div>
                            <button
                                onClick={triggerInstall}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-900/40 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Install Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Device-Specific Instructions (Only for detected device) */}
                <div className="space-y-2.5 relative z-10">
                    {/* 1. WINDOWS PC INSTRUCTIONS */}
                    {(os === "windows" || os === "desktop") && (
                        <div className="space-y-2.5 text-xs text-slate-300">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <p className="font-medium text-white">Browser Address Bar Icon</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Look at the top address bar in Chrome or Edge and click the <b className="text-white">Install (⊕ or ⤓)</b> icon on the right side.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    2
                                </span>
                                <div>
                                    <p className="font-medium text-white">Or via Browser Menu</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Click the <b className="text-white">Three Dots (⋮)</b> in Chrome/Edge &gt; <b className="text-white">Cast, save, and share</b> &gt; <b className="text-white">Install ChatApp...</b>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    3
                                </span>
                                <div>
                                    <p className="font-medium text-white">Desktop & Taskbar Shortcut</p>
                                    <p className="text-slate-400 mt-0.5">
                                        ChatApp will install onto your Windows PC with a desktop shortcut, taskbar icon, and offline support!
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. ANDROID INSTRUCTIONS */}
                    {os === "android" && (
                        <div className="space-y-2.5 text-xs text-slate-300">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <p className="font-medium text-white">Open Browser Menu</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Tap the <b className="text-white">Three Dots (⋮)</b> at the top right corner of Chrome.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    2
                                </span>
                                <div>
                                    <p className="font-medium text-white">Tap "Install app" / "Add to Home screen"</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Select <b className="text-white">"Install app"</b> or <b className="text-white">"Add to Home screen"</b> from the menu.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    3
                                </span>
                                <div>
                                    <p className="font-medium text-white">Instant Android PWA</p>
                                    <p className="text-slate-400 mt-0.5">
                                        The app installs directly in your app drawer without any large APK file.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. IPHONE & IPAD (iOS) INSTRUCTIONS */}
                    {os === "ios" && (
                        <div className="space-y-2.5 text-xs text-slate-300">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <p className="font-medium text-white">Open Safari & Tap Share</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Open this site in <b className="text-white">Safari</b> and tap the <b className="text-white">Share button</b> (square with arrow up at the bottom).
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    2
                                </span>
                                <div>
                                    <p className="font-medium text-white">Select "Add to Home Screen"</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Scroll down the share sheet and tap <b className="text-white">"Add to Home Screen" (+)</b>.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    3
                                </span>
                                <div>
                                    <p className="font-medium text-white">Confirm by Tapping "Add"</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Tap <b className="text-white">"Add"</b> in the top right. ChatApp will open in full-screen standalone mode!
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. MAC INSTRUCTIONS */}
                    {os === "mac" && (
                        <div className="space-y-2.5 text-xs text-slate-300">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <p className="font-medium text-white">In Chrome or Edge</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Click the <b className="text-white">Install (⊕)</b> button in the address bar.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    2
                                </span>
                                <div>
                                    <p className="font-medium text-white">In Safari (macOS)</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Click <b className="text-white">File</b> in the top menu bar &gt; <b className="text-white">Add to Dock...</b>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. LINUX INSTRUCTIONS */}
                    {os === "linux" && (
                        <div className="space-y-2.5 text-xs text-slate-300">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <span className="w-5 h-5 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                    1
                                </span>
                                <div>
                                    <p className="font-medium text-white">In Chrome / Chromium / Edge</p>
                                    <p className="text-slate-400 mt-0.5">
                                        Click the <b className="text-white">Install button (⊕)</b> in the address bar.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Features Badges */}
                <div className="mt-4 pt-3.5 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px] text-slate-300 relative z-10">
                    <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Full Offline Mode</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Instant Launch</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>Real-time Push Alerts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>No App Store Required</span>
                    </div>
                </div>

                {/* Bottom Close Button */}
                <div className="mt-4 relative z-10">
                    <button
                        onClick={closeInstallModal}
                        className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PwaInstallModal;
