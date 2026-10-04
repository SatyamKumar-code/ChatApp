import React, { useContext, useState, useRef, useEffect } from "react";
import Avatar from "../common/Avatar";
import { CallContext } from "../../context/CallContext";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

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
    onOpenChatTheme,
    isMuted = false,
    onToggleMute,
    onClearChat,
    onBlockContact,
    isBlocked = false,
    onForwardSelected,
}) => {
    const { startCall, startGroupCall } = useContext(CallContext);
    const {
        selectedMessageIds,
        clearSelectedMessages,
        selectAllMessages,
        deleteSelectedMessages,
        starSelectedMessages,
        copySelectedMessages,
        messages,
        togglePinMessage,
        setReplyingTo,
    } = useContext(ChatContext);
    const { user } = useContext(AuthContext);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);
    const [showDeleteSelectModal, setShowDeleteSelectModal] = useState(false);
    const [copiedSelected, setCopiedSelected] = useState(false);
    const menuRef = useRef(null);
    const selectMenuRef = useRef(null);

    const isSelectionMode = Boolean(selectedMessageIds && selectedMessageIds.length > 0);
    const selectedMessages = (messages || []).filter((m) =>
        selectedMessageIds.includes(m._id)
    );

    const areAllSelectedMine =
        selectedMessages.length > 0 &&
        selectedMessages.every(
            (m) => (m.sender?._id || m.sender)?.toString() === user?._id?.toString()
        );

    // Close 3-dot dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
            if (selectMenuRef.current && !selectMenuRef.current.contains(e.target)) {
                setIsSelectMenuOpen(false);
                setShowDeleteSelectModal(false);
            }
        };

        if (isMenuOpen || isSelectMenuOpen || showDeleteSelectModal) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen, isSelectMenuOpen, showDeleteSelectModal]);

    // Handle Escape key to cancel selection
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isSelectionMode) {
                clearSelectedMessages();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSelectionMode, clearSelectedMessages]);

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
        <header className="min-h-16 h-auto pt-[env(safe-area-inset-top,0px)] px-4 md:px-6 bg-[#0f0f1c] border-b border-white/5 flex items-center justify-between shrink-0 select-none z-10 relative">
            {isSelectionMode ? (
                /* WhatsApp-Style Multi-Select Top Bar */
                <div className="flex-1 flex items-center justify-between animate-in fade-in duration-150">
                    {/* Left: Close button and Selection Count */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={clearSelectedMessages}
                            title="Cancel selection (Esc)"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-base md:text-lg font-bold text-white font-mono">
                                {selectedMessageIds.length}
                            </span>
                            <span className="text-xs text-zinc-400 font-medium">
                                selected
                            </span>
                        </div>
                    </div>

                    {/* Right Action Icons: Star, Forward, Copy, Delete, 3-dots */}
                    <div className="flex items-center gap-1 relative" ref={selectMenuRef}>
                        {/* 1. Star / Unstar Button */}
                        <button
                            type="button"
                            onClick={starSelectedMessages}
                            title="Star / Unstar selected"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                        </button>

                        {/* 2. Forward Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (onForwardSelected) {
                                    onForwardSelected(selectedMessages);
                                }
                            }}
                            title="Forward selected"
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-purple-300 hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                    className="rotate-180 origin-center"
                                />
                            </svg>
                        </button>

                        {/* 3. Copy Text Button */}
                        <button
                            type="button"
                            onClick={() => {
                                const text = copySelectedMessages();
                                if (text) {
                                    setCopiedSelected(true);
                                    setTimeout(() => setCopiedSelected(false), 2000);
                                }
                            }}
                            title={copiedSelected ? "Copied!" : "Copy text"}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                                copiedSelected
                                    ? "text-emerald-400 bg-emerald-500/10"
                                    : "text-zinc-300 hover:text-white hover:bg-white/10"
                            }`}
                        >
                            {copiedSelected ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5 text-emerald-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            )}
                        </button>

                        {/* 4. Delete Button */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowDeleteSelectModal((prev) => !prev)}
                                title="Delete selected"
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                                    showDeleteSelectModal
                                        ? "bg-rose-600/20 text-rose-300"
                                        : "text-zinc-300 hover:text-rose-400 hover:bg-white/10"
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>

                            {/* Delete Dropdown Menu */}
                            {showDeleteSelectModal && (
                                <div className="dropdown-menu absolute right-0 top-11 w-48 bg-[#16162c] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl divide-y divide-white/5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowDeleteSelectModal(false);
                                            deleteSelectedMessages("forMe");
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-zinc-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                        <span>Delete for me</span>
                                    </button>
                                    {areAllSelectedMine && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDeleteSelectModal(false);
                                                deleteSelectedMessages("forEveryone");
                                            }}
                                            className="w-full text-left px-3.5 py-2 hover:bg-rose-500/15 flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-4 h-4 text-rose-400"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                            <span>Delete for everyone</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 5. 3-Dots More Options Menu */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsSelectMenuOpen((prev) => !prev)}
                                title="More options"
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                                    isSelectMenuOpen
                                        ? "bg-purple-600/20 text-purple-300"
                                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 5v.01M12 12v.01M12 19v.01"
                                    />
                                </svg>
                            </button>

                            {isSelectMenuOpen && (
                                <div className="dropdown-menu absolute right-0 top-11 w-48 bg-[#16162c] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl divide-y divide-white/5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSelectMenuOpen(false);
                                            selectAllMessages();
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-purple-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                            />
                                        </svg>
                                        <span>Select all</span>
                                    </button>

                                    {selectedMessageIds.length === 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsSelectMenuOpen(false);
                                                    if (selectedMessages[0]) {
                                                        setReplyingTo(selectedMessages[0]);
                                                        clearSelectedMessages();
                                                    }
                                                }}
                                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-4 h-4 text-indigo-400"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                                    />
                                                </svg>
                                                <span>Reply</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsSelectMenuOpen(false);
                                                    togglePinMessage(selectedMessageIds[0]);
                                                    clearSelectedMessages();
                                                }}
                                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-4 h-4 text-purple-400"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z"
                                                    />
                                                </svg>
                                                <span>Pin message</span>
                                            </button>
                                        </>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSelectMenuOpen(false);
                                            clearSelectedMessages();
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-zinc-400"
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
                                        <span>Deselect all</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : isSearching ? (
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
                                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 -ml-1 mr-1 cursor-pointer"
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
                                <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-purple-500/20 overflow-hidden">
                                    {partner.profilePicture ? (
                                        partner.profilePicture.startsWith("http") ||
                                        partner.profilePicture.startsWith("data:") ? (
                                            <img
                                                src={partner.profilePicture}
                                                alt={partner.name}
                                                className="w-full h-full object-cover rounded-full"
                                            />
                                        ) : (
                                            <span className="text-xl leading-none">{partner.profilePicture}</span>
                                        )
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
                                {isMuted && (
                                    <span className="text-zinc-400 text-xs" title="Notifications muted">
                                        🔕
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                {partner.isBlockedByOther ? (
                                    <span className="text-rose-400 font-medium flex items-center gap-1">
                                        <span>🚫</span>
                                        <span>Blocked</span>
                                    </span>
                                ) : isTyping ? (
                                    <span className="text-purple-400 font-medium animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                        typing...
                                    </span>
                                ) : partner.isGroup ? (
                                    <span className="text-zinc-400 text-[11px] truncate">
                                        {partner.isLeft
                                            ? "You are no longer a member"
                                            : partner.participantsCount
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

                    {/* Right: Actions (Audio & Video Calls directly visible; rest in 3-dots menu) */}
                    <div className="flex items-center gap-1 relative" ref={menuRef}>
                        {/* Audio Call */}
                        {(!partner.isGroup || !partner.isLeft) && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!navigator.onLine) {
                                        window.alert("Calls unavailable while offline");
                                        return;
                                    }
                                    if (partner.isGroup) {
                                        startGroupCall(partner, "audio");
                                    } else {
                                        startCall(partner, "audio");
                                    }
                                }}
                                title={!navigator.onLine ? "Calls unavailable while offline" : (partner.isGroup ? "Group Audio Call" : "Audio Call")}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                    !navigator.onLine
                                        ? "text-zinc-500 opacity-50 cursor-not-allowed"
                                        : "text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4.5 h-4.5"
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

                        {/* Video Call */}
                        {(!partner.isGroup || !partner.isLeft) && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!navigator.onLine) {
                                        window.alert("Calls unavailable while offline");
                                        return;
                                    }
                                    if (partner.isGroup) {
                                        startGroupCall(partner, "video");
                                    } else {
                                        startCall(partner, "video");
                                    }
                                }}
                                title={!navigator.onLine ? "Calls unavailable while offline" : (partner.isGroup ? "Group Video Call" : "Video Call")}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                    !navigator.onLine
                                        ? "text-zinc-500 opacity-50 cursor-not-allowed"
                                        : "text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                                }`}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4.5 h-4.5"
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

                        {/* 3-Dots Menu Button */}
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            title="More options"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                isMenuOpen
                                    ? "bg-purple-600/20 text-purple-300"
                                    : "text-zinc-300 hover:text-white hover:bg-white/10"
                            }`}
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
                                    strokeWidth={2.5}
                                    d="M12 5v.01M12 12v.01M12 19v.01"
                                />
                            </svg>
                        </button>

                        {/* 3-Dots Dropdown Popup */}
                        {isMenuOpen && (
                            <div className="dropdown-menu absolute right-0 top-11 w-56 bg-[#16162c] border border-white/10 rounded-2xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl divide-y divide-white/5">
                                <div className="py-1">
                                    {/* 1. Chat Theme */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onOpenChatTheme?.();
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-purple-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M7 21a4 4 0 01-4-4 4 4 0 014-4c.48 0 .93.09 1.34.25A4.004 4.004 0 0115 11h2a2 2 0 012 2v1a2 2 0 01-2 2h-1a2 2 0 00-2 2v2a2 2 0 01-2 2h-2z"
                                            />
                                        </svg>
                                        <span>Chat theme</span>
                                    </button>

                                    {/* 2. Mute / Unmute Notifications */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onToggleMute?.();
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-indigo-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            {isMuted ? (
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                                />
                                            ) : (
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5.586 15H4a1 1 0 01-.707-1.707l1.414-1.414A2 2 0 005.414 10.46V10a6.5 6.5 0 0110.828-4.78M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M15 17v1a3 3 0 11-6 0v-1"
                                                />
                                            )}
                                        </svg>
                                        <span>
                                            {isMuted ? "Unmute notifications" : "Mute notifications"}
                                        </span>
                                    </button>

                                    {/* 3. Search in Conversation */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setIsSearching?.(true);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-zinc-400"
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
                                        <span>Search in chat</span>
                                    </button>

                                    {/* 4. Starred Messages */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onOpenStarred?.();
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-amber-400"
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
                                        <span>Starred messages</span>
                                    </button>
                                </div>

                                <div className="py-1">
                                    {/* 5. Clear Chat */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onClearChat?.();
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-amber-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                        <span>Clear chat</span>
                                    </button>

                                    {/* 6. Block Contact / Leave Group */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onBlockContact?.();
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-4 h-4 text-rose-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                            />
                                        </svg>
                                        <span>
                                            {partner.isGroup
                                                ? partner.isLeft
                                                    ? "Delete group"
                                                    : "Leave group"
                                                : isBlocked
                                                ? "Unblock contact"
                                                : "Block contact"}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </header>
    );
};

export default ChatHeader;
