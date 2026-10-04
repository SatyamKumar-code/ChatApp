import React, { useEffect } from "react";

export const StylishAlert = ({
    isOpen,
    onClose,
    message = "You are currently offline",
    type = "offline",
    duration = 3200,
}) => {
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            onClose?.();
        }, duration);

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose, duration]);

    if (!isOpen || !message) return null;

    // Normalize and shorten common long sentences to clean, punchy 1-liners
    let cleanMessage = String(message).trim();
    if (cleanMessage.toLowerCase().includes("require an active internet") || cleanMessage.toLowerCase().includes("please connect to the internet to make calls")) {
        cleanMessage = "Calls unavailable while offline";
    }

    // Type styles configuration
    const typeConfig = {
        offline: {
            border: "border-amber-500/40",
            bg: "bg-[#18182e]/95",
            iconBg: "bg-amber-500/20 text-amber-400",
            glow: "shadow-amber-500/10",
            icon: (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
                </svg>
            ),
        },
        error: {
            border: "border-rose-500/40",
            bg: "bg-[#1c1424]/95",
            iconBg: "bg-rose-500/20 text-rose-400",
            glow: "shadow-rose-500/10",
            icon: (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <circle cx="12" cy="12" r="9" />
                    <line x1="15" y1="9" x2="9" y2="15" strokeLinecap="round" />
                    <line x1="9" y1="9" x2="15" y2="15" strokeLinecap="round" />
                </svg>
            ),
        },
        success: {
            border: "border-emerald-500/40",
            bg: "bg-[#121c20]/95",
            iconBg: "bg-emerald-500/20 text-emerald-400",
            glow: "shadow-emerald-500/10",
            icon: (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ),
        },
        warning: {
            border: "border-amber-500/40",
            bg: "bg-[#1c1814]/95",
            iconBg: "bg-amber-500/20 text-amber-400",
            glow: "shadow-amber-500/10",
            icon: (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
        },
        info: {
            border: "border-purple-500/40",
            bg: "bg-[#18142a]/95",
            iconBg: "bg-purple-500/20 text-purple-400",
            glow: "shadow-purple-500/10",
            icon: (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
                    <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" />
                </svg>
            ),
        },
    };

    const cfg = typeConfig[type] || typeConfig.info;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] px-3 pointer-events-auto">
            <div
                className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full ${cfg.bg} ${cfg.border} border shadow-xl ${cfg.glow} backdrop-blur-xl text-white select-none animate-in fade-in slide-in-from-top-3 duration-200 ring-1 ring-white/10`}
            >
                {/* Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                    {cfg.icon}
                </div>

                {/* Short Text */}
                <span className="text-xs font-medium tracking-wide text-zinc-100 pr-1 max-w-[280px] sm:max-w-md truncate">
                    {cleanMessage}
                </span>

                {/* Dismiss */}
                <button
                    type="button"
                    onClick={onClose}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
                    title="Dismiss"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default StylishAlert;
