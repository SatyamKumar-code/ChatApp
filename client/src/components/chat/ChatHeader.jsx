import React, { useContext } from "react";
import Avatar from "../common/Avatar";
import { CallContext } from "../../context/CallContext";

export const ChatHeader = ({
    partner,
    isTyping = false,
    onToggleProfile,
    isProfileOpen = false,
    onBack,
    isSearching = false,
    setIsSearching,
    searchTerm = "",
    setSearchTerm,
    matchesCount = 0,
    currentMatchIndex = 0,
    onNextMatch,
    onPrevMatch,
    onOpenStarred,
}) => {
    const { startCall } = useContext(CallContext);

    if (!partner) return null;

    const formatLastSeen = (date) => {
        if (!date) return "Offline";
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000 && d.getDate() === now.getDate()) {
            return `Today at ${d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`;
        }
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    return (
        <header className="h-16 px-4 md:px-6 bg-[#0f0f1c] border-b border-white/5 flex items-center justify-between shrink-0 select-none z-10 relative">
            {isSearching ? (
                /* In-Chat Message Search Bar */
                <div className="flex-1 flex items-center gap-2 animate-in fade-in duration-150">
                    <div className="relative flex-1 flex items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4 text-purple-400 absolute left-3 pointer-events-none"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    if (e.shiftKey) onPrevMatch?.();
                                    else onNextMatch?.();
                                }
                                if (e.key === "Escape") {
                                    setIsSearching?.(false);
                                    setSearchTerm?.("");
                                }
                            }}
                            placeholder="Search in this conversation..."
                            autoFocus
                            className="w-full pl-9 pr-24 py-2 rounded-xl bg-[#16162a] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                        />
                        {searchTerm && (
                            <span className="absolute right-3 text-[11px] font-mono text-zinc-400 select-none">
                                {matchesCount > 0
                                    ? `${currentMatchIndex + 1} of ${matchesCount}`
                                    : "0 found"}
                            </span>
                        )}
                    </div>

                    {/* Up / Down Navigation for Matches */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onPrevMatch}
                            disabled={matchesCount === 0}
                            title="Previous match (Shift + Enter)"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 15l7-7 7 7"
                                />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={onNextMatch}
                            disabled={matchesCount === 0}
                            title="Next match (Enter)"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsSearching?.(false);
                                setSearchTerm?.("");
                            }}
                            title="Close search (Esc)"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer ml-1"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Mobile Back Button */}
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 -ml-1 mr-1"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                            </button>
                        )}

                        <div
                            onClick={onToggleProfile}
                            className="cursor-pointer transition-transform hover:opacity-90"
                        >
                            {partner.isGroup ? (
                                <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-purple-500/20">
                                    {partner.profilePicture ? (
                                        <img
                                            src={partner.profilePicture}
                                            alt={partner.name}
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-5 h-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                            />
                                        </svg>
                                    )}
                                </div>
                            ) : (
                                <Avatar
                                    src={partner.profilePicture}
                                    name={partner.name}
                                    size={42}
                                    isOnline={partner.isOnline}
                                />
                            )}
                        </div>

                        <div
                            onClick={onToggleProfile}
                            className="min-w-0 cursor-pointer"
                        >
                            <div className="flex items-center gap-1.5">
                                <h2 className="text-sm font-semibold text-white truncate hover:text-purple-300 transition-colors">
                                    {partner.name}
                                </h2>
                                {partner.isGroup && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-medium border border-purple-500/30">
                                        Group
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                {isTyping ? (
                                    <span className="text-purple-400 font-medium animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                        typing...
                                    </span>
                                ) : partner.isGroup ? (
                                    <span className="text-zinc-400 text-[11px] truncate">
                                        {partner.participantsCount
                                            ? `${partner.participantsCount} members`
                                            : "Group Chat"}
                                    </span>
                                ) : partner.isOnline ? (
                                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Online
                                    </span>
                                ) : (
                                    <span className="text-zinc-400">
                                        Last seen {formatLastSeen(partner.lastSeen)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1">
                        {/* Voice Call (1-on-1 only) */}
                        {!partner.isGroup && (
                            <button
                                type="button"
                                onClick={() => startCall(partner, "audio")}
                                title="Voice Call"
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    />
                                </svg>
                            </button>
                        )}

                        {/* Video Call (1-on-1 only) */}
                        {!partner.isGroup && (
                            <button
                                type="button"
                                onClick={() => startCall(partner, "video")}
                                title="Video Call"
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            </button>
                        )}

                        {/* In-Chat Message Search */}
                        <button
                            type="button"
                            onClick={() => setIsSearching?.(true)}
                            title="Search in conversation"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </button>

                        {/* Starred Messages */}
                        <button
                            type="button"
                            onClick={onOpenStarred}
                            title="Starred messages"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                        </button>

                        {/* Toggle Profile / Group Panel */}
                        <button
                            type="button"
                            onClick={onToggleProfile}
                            title="Conversation details"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                isProfileOpen
                                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </button>
                    </div>
                </>
            )}
        </header>
    );
};

export default ChatHeader;
