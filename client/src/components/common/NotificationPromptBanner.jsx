import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import {
    isPushSupported,
    getNotificationPermission,
    getActiveSubscription,
    subscribeToPush,
} from "../../services/pushNotificationService";

export const NotificationPromptBanner = () => {
    const { user } = useContext(AuthContext);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            setVisible(false);
            return;
        }

        const checkPromptStatus = async () => {
            if (!isPushSupported()) return;

            const dismissed = localStorage.getItem("chatapp_push_banner_dismissed");
            if (dismissed === "true") return;

            const perm = getNotificationPermission();
            if (perm === "denied" || perm === "granted") {
                return;
            }

            const sub = await getActiveSubscription();
            if (!sub) {
                // Show prompt after a gentle 3-second delay on first load
                const timer = setTimeout(() => {
                    setVisible(true);
                }, 3000);
                return () => clearTimeout(timer);
            }
        };

        checkPromptStatus();
    }, [user]);

    const handleEnable = async () => {
        try {
            setLoading(true);
            await subscribeToPush();
            setVisible(false);
        } catch (err) {
            console.error("Banner push enable error:", err);
            setVisible(false);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        try {
            localStorage.setItem("chatapp_push_banner_dismissed", "true");
        } catch (e) {}
    };

    if (!visible) return null;

    return (
        <aside
            aria-label="Push notifications setup banner"
            className="fixed top-3 inset-x-3 sm:top-4 sm:inset-x-auto sm:right-4 z-40 max-w-sm mx-auto sm:mx-0 animate-in fade-in slide-in-from-top-4 duration-300 select-none"
        >
            <div className="relative overflow-hidden rounded-2xl p-3.5 bg-[#14142b]/95 backdrop-blur-xl border border-purple-500/30 shadow-2xl shadow-purple-950/60 text-white flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-900/40">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 animate-bounce"
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

                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white">Enable Notifications</h4>
                    <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                        Receive incoming calls and new message alerts even when ChatApp is closed.
                    </p>

                    <div className="flex items-center gap-2 mt-2.5">
                        <button
                            type="button"
                            onClick={handleEnable}
                            disabled={loading}
                            className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-all shadow-md shadow-purple-900/30 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? "Enabling..." : "Enable"}
                        </button>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white text-[11px] transition-colors cursor-pointer"
                        >
                            Later
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                    title="Dismiss"
                >
                    ✕
                </button>
            </div>
        </aside>
    );
};

export default NotificationPromptBanner;
