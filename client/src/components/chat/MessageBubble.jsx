import React, { useState, useRef, useEffect } from "react";
import AudioPlayer from "./AudioPlayer";

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const MessageBubble = ({
    message,
    isMyMessage,
    currentUserId,
    onReply,
    onForward,
    onReact,
    onDelete,
    onToggleStar,
    onTogglePin,
    isPinned = false,
    searchHighlight = "",
}) => {
    const [showImagePreview, setShowImagePreview] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [showDeleteMenu, setShowDeleteMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    const actionMenuRef = useRef(null);

    // Close delete menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
                setShowDeleteMenu(false);
            }
        };
        if (showDeleteMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showDeleteMenu]);

    const formatTime = (date) => {
        if (!date) return "";
        return new Date(date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isStarredByMe =
        Array.isArray(message.starredBy) &&
        message.starredBy.some(
            (id) => (id?._id || id)?.toString() === currentUserId?.toString()
        );

    const renderHighlightedText = (text, highlight) => {
        if (!highlight || !highlight.trim()) return text;
        try {
            const escaped = highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
            const parts = text.split(new RegExp(`(${escaped})`, "gi"));
            return parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase() ? (
                    <mark
                        key={i}
                        className="bg-amber-400 text-zinc-950 font-semibold px-0.5 rounded shadow-xs"
                    >
                        {part}
                    </mark>
                ) : (
                    part
                )
            );
        } catch (e) {
            return text;
        }
    };

    const handleCopy = () => {
        if (!message.text) return;
        navigator.clipboard.writeText(message.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // If message is deleted
    if (message.isDeleted || message.deletedForEveryone) {
        return (
            <div
                className={`flex w-full mb-3 ${
                    isMyMessage ? "justify-end" : "justify-start"
                }`}
            >
                <div
                    className={`max-w-[85%] sm:max-w-[70%] md:max-w-[55%] rounded-2xl px-3.5 py-2.5 text-xs italic flex items-center gap-2 border select-none transition-all ${
                        isMyMessage
                            ? "bg-purple-950/20 border-purple-800/25 text-purple-300/70 rounded-br-xs"
                            : "bg-[#141426] border-white/5 text-zinc-500 rounded-bl-xs"
                    }`}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-zinc-500 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.75}
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                    </svg>
                    <span>This message was deleted</span>
                    <span className="text-[10px] text-zinc-500 ml-auto not-italic">
                        {formatTime(message.createdAt)}
                    </span>
                </div>
            </div>
        );
    }

    const isAudio =
        message.messageType === "audio" ||
        (message.fileUrl &&
            (message.fileUrl.startsWith("data:audio") ||
                message.fileUrl.includes("audio/")));
    const isImage =
        !isAudio &&
        (message.messageType === "image" ||
            (message.fileUrl && message.fileUrl.startsWith("data:image")));
    const isFile =
        !isAudio &&
        !isImage &&
        (message.messageType === "file" || Boolean(message.fileUrl));

    // Group reactions: { "❤️": { count: 2, users: [...], reactedByMe: true } }
    const reactionGroups = (message.reactions || []).reduce((acc, r) => {
        if (!r.emoji) return acc;
        if (!acc[r.emoji]) {
            acc[r.emoji] = { count: 0, users: [], reactedByMe: false };
        }
        acc[r.emoji].count += 1;
        const uid = r.user?._id || r.user;
        if (r.user?.name) acc[r.emoji].users.push(r.user.name);
        if (uid === currentUserId) acc[r.emoji].reactedByMe = true;
        return acc;
    }, {});

    const scrollToRepliedMessage = (repliedId) => {
        if (!repliedId) return;
        const el = document.getElementById(`msg-${repliedId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-purple-400", "scale-[1.01]");
            setTimeout(() => {
                el.classList.remove("ring-2", "ring-purple-400", "scale-[1.01]");
            }, 1500);
        }
    };

    return (
        <>
            <div
                id={`msg-${message._id}`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => {
                    setShowActions(false);
                    setShowDeleteMenu(false);
                }}
                className={`flex flex-col w-full mb-3 group relative transition-all ${
                    isMyMessage ? "items-end" : "items-start"
                }`}
            >
                {/* Floating Quick Action Bar (on hover or active) */}
                <div
                    ref={actionMenuRef}
                    className={`absolute -top-7 z-20 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-[#1e1e38]/95 backdrop-blur-md border border-white/10 shadow-lg text-zinc-300 transition-all duration-150 ${
                        showActions || showDeleteMenu
                            ? "opacity-100 pointer-events-auto translate-y-0"
                            : "opacity-0 pointer-events-none translate-y-1"
                    } ${isMyMessage ? "right-2" : "left-2"}`}
                >
                    {/* Quick Reactions */}
                    <div className="flex items-center gap-0.5 pr-1 border-r border-white/10">
                        {QUICK_REACTIONS.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => onReact && onReact(message._id, emoji)}
                                className="w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform text-xs"
                                title={`React ${emoji}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    {/* Reply Button */}
                    <button
                        onClick={() => onReply && onReply(message)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-colors"
                        title="Reply"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5"
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
                    </button>

                    {/* Forward Button */}
                    <button
                        onClick={() => onForward && onForward(message)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-colors"
                        title="Forward"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5"
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

                    {/* Copy Text Button (if text exists) */}
                    {message.text && (
                        <button
                            onClick={handleCopy}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-colors"
                            title={copied ? "Copied!" : "Copy message"}
                        >
                            {copied ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5 text-emerald-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Star / Unstar Message Button */}
                    <button
                        onClick={() => onToggleStar && onToggleStar(message._id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ${
                            isStarredByMe ? "text-amber-400" : "hover:text-amber-300"
                        }`}
                        title={isStarredByMe ? "Unstar message" : "Star message"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5"
                            fill={isStarredByMe ? "currentColor" : "none"}
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

                    {/* Pin / Unpin Message Button */}
                    <button
                        onClick={() => onTogglePin && onTogglePin(message._id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ${
                            isPinned ? "text-purple-400" : "hover:text-purple-300"
                        }`}
                        title={isPinned ? "Unpin message" : "Pin message"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5"
                            viewBox="0 0 24 24"
                            fill={isPinned ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z"
                            />
                        </svg>
                    </button>

                    {/* Delete Message Popover */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            title="Delete options"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-3.5 h-3.5"
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
                        </button>

                        {/* Dropdown Menu */}
                        {showDeleteMenu && (
                            <div
                                className={`absolute bottom-full mb-2 z-30 w-44 rounded-xl bg-[#1a1a32] border border-white/10 shadow-2xl py-1 text-xs text-zinc-200 animate-in fade-in duration-100 ${
                                    isMyMessage ? "right-0" : "left-0"
                                }`}
                            >
                                <button
                                    onClick={() => {
                                        setShowDeleteMenu(false);
                                        onDelete && onDelete(message._id, "forMe");
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-zinc-300 hover:text-white transition-colors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-3.5 h-3.5 text-zinc-400"
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
                                    Delete for me
                                </button>

                                {isMyMessage && (
                                    <button
                                        onClick={() => {
                                            setShowDeleteMenu(false);
                                            onDelete && onDelete(message._id, "forEveryone");
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-red-500/15 flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-3.5 h-3.5 text-red-400"
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
                                        Delete for everyone
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Message Bubble Card */}
                <div
                    className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-sm text-sm relative transition-all duration-200 ${
                        isMyMessage
                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs shadow-purple-900/20"
                            : "bg-[#181830] text-zinc-100 rounded-bl-xs border border-white/5 shadow-black/20"
                    }`}
                >
                    {/* Sender Name for received in group/chats */}
                    {!isMyMessage && message.sender?.name && (
                        <div className="text-[11px] font-semibold text-purple-300 mb-1 select-none">
                            {message.sender.name}
                        </div>
                    )}

                    {/* Forwarded Header Indicator */}
                    {message.isForwarded && (
                        <div
                            className={`flex items-center gap-1 text-[11px] italic mb-1.5 select-none ${
                                isMyMessage ? "text-purple-200/90" : "text-zinc-400"
                            }`}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`w-3 h-3 ${isMyMessage ? "text-purple-200/90" : "text-zinc-400"}`}
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
                            <span>Forwarded</span>
                        </div>
                    )}

                    {/* Quoted Replying Header */}
                    {message.replyTo && (
                        <div
                            onClick={() => scrollToRepliedMessage(message.replyTo._id)}
                            className={`mb-2 p-2 rounded-xl text-xs border-l-4 cursor-pointer transition-all ${
                                isMyMessage
                                    ? "bg-black/25 border-white/90 hover:bg-black/35 text-white/95"
                                    : "bg-black/30 border-purple-500 hover:bg-black/45 text-zinc-300"
                            }`}
                        >
                            <div className="font-semibold text-[11px] text-purple-300 mb-0.5 truncate flex items-center gap-1">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3 h-3 text-purple-400"
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
                                <span>{message.replyTo.sender?.name || "Replying to"}</span>
                            </div>
                            <div className="truncate text-[11px] opacity-80">
                                {message.replyTo.messageType === "image" && "📷 Photo"}
                                {message.replyTo.messageType === "audio" && "🎤 Voice note"}
                                {message.replyTo.messageType === "file" &&
                                    `📄 ${message.replyTo.fileName || "Document"}`}
                                {(!message.replyTo.messageType ||
                                    message.replyTo.messageType === "text") &&
                                    (message.replyTo.text || "Message")}
                            </div>
                        </div>
                    )}

                    {/* Voice Note Audio Attachment */}
                    {isAudio && message.fileUrl && (
                        <div className="mb-1">
                            <AudioPlayer
                                audioUrl={message.fileUrl}
                                duration={message.duration}
                                isMyMessage={isMyMessage}
                            />
                        </div>
                    )}

                    {/* Image Attachment */}
                    {isImage && message.fileUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden cursor-pointer group/img relative">
                            <img
                                src={message.fileUrl}
                                alt={message.fileName || "Shared image"}
                                onClick={() => setShowImagePreview(true)}
                                className="w-full max-h-80 object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.01]"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-md">
                                    Click to view
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Document / File Attachment */}
                    {isFile && message.fileUrl && (
                        <a
                            href={message.fileUrl}
                            download={message.fileName || "attachment"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-2.5 mb-2 rounded-xl bg-black/25 hover:bg-black/40 border border-white/10 transition-all group/doc"
                        >
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 group-hover/doc:scale-105 transition-transform">
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
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate group-hover/doc:underline">
                                    {message.fileName || "Download Document"}
                                </p>
                                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                    {formatBytes(message.fileSize) || "File"}
                                </p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-zinc-300 group-hover/doc:text-white shrink-0">
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
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                            </div>
                        </a>
                    )}

                    {/* Message Body / Caption */}
                    {message.text && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed text-[13px] md:text-sm">
                            {renderHighlightedText(message.text, searchHighlight)}
                        </p>
                    )}

                    {/* Message Footer: Timestamp & Status & Star */}
                    <div
                        className={`flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] ${
                            isMyMessage ? "text-purple-200" : "text-zinc-400"
                        }`}
                    >
                        {/* Pinned Indicator Badge */}
                        {isPinned && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-3 h-3 text-purple-400 fill-purple-400 shrink-0"
                                viewBox="0 0 24 24"
                                title="Pinned message"
                            >
                                <path d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z" />
                            </svg>
                        )}

                        {/* Starred Indicator Badge */}
                        {isStarredByMe && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                title="Starred message"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                        )}
                        <span>{formatTime(message.createdAt)}</span>

                        {/* Status Ticks for Sent Messages */}
                        {isMyMessage && (
                            <span
                                className={`font-mono text-xs tracking-tighter ${
                                    message.isSeen
                                        ? "text-sky-300 font-bold"
                                        : "text-purple-200/80"
                                }`}
                                title={
                                    message.isSeen
                                        ? "Read"
                                        : message.isDelivered
                                        ? "Delivered"
                                        : "Sent"
                                }
                            >
                                {message.isSeen
                                    ? "✓✓"
                                    : message.isDelivered
                                    ? "✓✓"
                                    : "✓"}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reaction Badges Display */}
                {Object.keys(reactionGroups).length > 0 && (
                    <div
                        className={`flex flex-wrap gap-1 mt-1 z-10 ${
                            isMyMessage ? "justify-end" : "justify-start"
                        }`}
                    >
                        {Object.entries(reactionGroups).map(([emoji, data]) => (
                            <button
                                key={emoji}
                                onClick={() => onReact && onReact(message._id, emoji)}
                                title={
                                    data.users.length
                                        ? data.users.join(", ")
                                        : undefined
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 hover:scale-105 select-none ${
                                    data.reactedByMe
                                        ? "bg-purple-600/35 border border-purple-400/50 text-purple-200 shadow-sm shadow-purple-900/40"
                                        : "bg-[#181830] border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white"
                                }`}
                            >
                                <span className="text-[12px]">{emoji}</span>
                                {data.count > 1 && (
                                    <span className="text-[10px] font-semibold font-mono">
                                        {data.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Full Screen Image Lightbox Preview */}
            {showImagePreview && (
                <div
                    onClick={() => setShowImagePreview(false)}
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                >
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <a
                            href={message.fileUrl}
                            download={message.fileName || "image.png"}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
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
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                            </svg>
                            Download
                        </a>
                        <button
                            onClick={() => setShowImagePreview(false)}
                            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                        >
                            ✕
                        </button>
                    </div>

                    <img
                        src={message.fileUrl}
                        alt="Full Preview"
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                    />

                    {message.fileName && (
                        <p className="text-xs text-zinc-400 mt-3 font-mono">
                            {message.fileName}
                        </p>
                    )}
                </div>
            )}
        </>
    );
};

export default MessageBubble;
