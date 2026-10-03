import React, { useState } from "react";

export const PinnedMessageBanner = ({ pinnedMessages = [], onUnpin, onJumpToMessage }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!pinnedMessages || pinnedMessages.length === 0) return null;

    // Safety check index bounds
    const safeIndex = currentIndex < pinnedMessages.length ? currentIndex : 0;
    const currentPinned = pinnedMessages[safeIndex];

    if (!currentPinned) return null;

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % pinnedMessages.length);
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
    };

    const handleClickBanner = () => {
        if (onJumpToMessage && currentPinned._id) {
            onJumpToMessage(currentPinned._id);
        } else {
            const el = document.getElementById(`msg-${currentPinned._id}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-purple-400", "rounded-2xl");
                setTimeout(() => {
                    el.classList.remove("ring-2", "ring-purple-400", "rounded-2xl");
                }, 2000);
            }
        }
    };

    const senderName = currentPinned.sender?.name || "User";

    const getPreviewText = () => {
        if (currentPinned.isDeleted || currentPinned.deletedForEveryone) {
            return "🚫 This message was deleted";
        }
        if (currentPinned.text) {
            return currentPinned.text;
        }
        if (currentPinned.messageType === "audio") return "🎤 Voice message";
        if (currentPinned.messageType === "image") return "📷 Photo";
        if (currentPinned.messageType === "file") return `📄 ${currentPinned.fileName || "Document"}`;
        return "Message";
    };

    return (
        <div className="px-4 py-1.5 bg-[#0f0f20]/95 backdrop-blur-md border-b border-purple-500/20 z-10 select-none animate-in slide-in-from-top-2 duration-200">
            <div
                onClick={handleClickBanner}
                className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/20 transition-all cursor-pointer group"
                title="Click to jump to pinned message"
            >
                {/* Left: Glowing Pin Icon + Message Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5 fill-current"
                            viewBox="0 0 24 24"
                        >
                            <path d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z" />
                        </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-purple-300">
                                Pinned Message
                            </span>
                            {pinnedMessages.length > 1 && (
                                <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10">
                                    {safeIndex + 1} of {pinnedMessages.length}
                                </span>
                            )}
                            <span className="text-[11px] text-zinc-400 font-medium truncate">
                                • {senderName}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-300 truncate font-normal mt-0.5">
                            {getPreviewText()}
                        </p>
                    </div>
                </div>

                {/* Right: Next / Prev arrows + Unpin button */}
                <div className="flex items-center gap-1 shrink-0">
                    {pinnedMessages.length > 1 && (
                        <div className="flex items-center gap-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={handlePrev}
                                title="Previous pinned message"
                                className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                title="Next pinned message"
                                className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Unpin Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onUnpin && onUnpin(currentPinned._id);
                        }}
                        title="Unpin message"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PinnedMessageBanner;
