import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
    isPushSupported,
    getNotificationPermission,
    subscribeToPush,
} from "../../services/pushNotificationService";

export const NotificationPromptBanner = () => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Only trigger on home page when user is logged in
        if (!user || location.pathname !== "/") {
            setVisible(false);
            return;
        }

        const checkPromptStatus = async () => {
            if (!isPushSupported()) return;

            const perm = getNotificationPermission();

            // If already granted, auto-sync push subscription with backend in background
            if (perm === "granted") {
                subscribeToPush().catch((err) => {
                    console.debug("[NotificationPrompt] Background sync error:", err);
                });
                setVisible(false);
                return;
            }

            // If user explicitly blocked/denied notifications in browser, don't show
            if (perm === "denied") {
                setVisible(false);
                return;
            }

            // If permission is 'default' (not yet asked or decided)
            const dismissedThisSession = sessionStorage.getItem("chatapp_push_prompt_dismissed");
            if (dismissedThisSession === "true") {
                return;
            }

            // Show prompt modal immediately on home page
            setVisible(true);

            // Also attempt direct browser prompt if permitted
            try {
                if (typeof Notification !== "undefined" && Notification.requestPermission) {
                    Notification.requestPermission().then((res) => {
                        if (res === "granted") {
                            setSuccess(true);
                            subscribeToPush().catch(() => {});
                            setTimeout(() => {
                                setVisible(false);
                            }, 1200);
                        } else if (res === "denied") {
                            setVisible(false);
                        }
                    }).catch(() => {});
                }
            } catch (e) {}
        };

        checkPromptStatus();
    }, [user, location.pathname]);

    const handleEnable = async () => {
        try {
            setLoading(true);
            await subscribeToPush();
            setSuccess(true);
            setTimeout(() => {
                setVisible(false);
            }, 1200);
        } catch (err) {
            console.warn("First-time notification enable warning:", err);
            setVisible(false);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        try {
            sessionStorage.setItem("chatapp_push_prompt_dismissed", "true");
        } catch (e) {}
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-prompt-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#14142b]/95 border border-purple-500/30 p-6 shadow-2xl shadow-purple-950/70 text-white animate-in zoom-in-95 duration-200">
                {/* Glow accent */}
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

                {/* Close button */}
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Close"
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Icon header */}
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-purple-900/50 mb-4 animate-bounce">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-7 h-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                            />
                        </svg>
                    </div>

                    <h3 id="notif-prompt-title" className="text-lg font-bold text-white tracking-tight">
                        Enable Notifications
                    </h3>
                    <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed max-w-sm">
                        Never miss incoming calls or new messages, even when ChatApp is closed or running in the background.
                    </p>
                </div>

                {/* Feature highlights */}
                <div className="mt-5 space-y-2.5 bg-white/[0.04] p-3.5 rounded-2xl border border-white/5 text-xs text-zinc-300">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                            📞
                        </div>
                        <span><strong>Incoming Calls:</strong> Ring your device instantly when someone calls</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                            💬
                        </div>
                        <span><strong>New Messages:</strong> Real-time message previews & double tick status</span>
                    </div>
                </div>

                {/* Status or Actions */}
                <div className="mt-6 flex flex-col gap-2.5">
                    {success ? (
                        <div className="py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
                            <span>✓</span>
                            <span>Notifications Enabled Successfully!</span>
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleEnable}
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-900/40 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        <span>Requesting Permission...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Allow Notifications</span>
                                        <span className="text-purple-200">🔔</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleDismiss}
                                disabled={loading}
                                className="w-full py-2 text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                                Maybe Later
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationPromptBanner;
