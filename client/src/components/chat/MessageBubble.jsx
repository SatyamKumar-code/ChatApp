import React, { useState, useRef, useEffect, useContext } from "react";
import AudioPlayer from "./AudioPlayer";
import Avatar from "../common/Avatar";
import { CallContext } from "../../context/CallContext";
import { ChatContext } from "../../context/ChatContext";
import { decryptMessage } from "../../utils/e2ee";
import CircularTransferProgress from "./CircularTransferProgress";
import { getLocalFile } from "../../services/localFileRegistry";
import { isMobileDevice } from "../../services/fileSystemStorage";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EXTRA_REACTIONS = [
    "🔥", "🎉", "👏", "💯", "🥰", "🤩", "🤝", "💔",
    "👀", "🚀", "✨", "🤔", "😎", "🙌", "🥳", "😍",
    "💪", "💡", "😭", "🤯", "🫡", "🤮", "🥺", "😇"
];

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
    isGroup = false,
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
    const {
        selectedMessageIds,
        toggleSelectMessage,
        selectedConversation,
        messages,
        fileTransfers,
        downloadAndSaveFile,
        requestFileRedownload,
    } = useContext(ChatContext) || {};
    const myId = (currentUserId?._id || currentUserId)?.toString();
    const senderId = (message?.sender?._id || message?.sender)?.toString();
    const isMe = typeof isMyMessage === "boolean" ? isMyMessage : Boolean(myId && senderId && myId === senderId);
    const isSelectionMode = Boolean(selectedMessageIds && selectedMessageIds.length > 0);
    const isSelected = Boolean(selectedMessageIds && selectedMessageIds.includes(message._id));

    const isAudio =
        message.messageType === "audio" ||
        (message.fileUrl &&
            (message.fileUrl.startsWith("data:audio") ||
                message.fileUrl.includes("audio/")));
    const isImage =
        !isAudio &&
        (message.messageType === "image" ||
            message.fileModelRef === "Image" ||
            (message.fileUrl && message.fileUrl.startsWith("data:image")));
    const isVideo =
        !isAudio &&
        (message.messageType === "video" ||
            message.fileModelRef === "Video" ||
            (message.fileUrl && (message.fileUrl.startsWith("data:video") || message.fileUrl.includes(".mp4"))));
    const isFile =
        !isAudio &&
        !isImage &&
        !isVideo &&
        (message.messageType === "file" ||
            message.messageType === "document" ||
            message.fileModelRef === "Document" ||
            Boolean(message.fileId));

    const fileName =
        message.fileName ||
        message.imageDetails?.fileName ||
        message.videoDetails?.fileName ||
        message.documentDetails?.fileName ||
        "Attachment";
    const fileSize =
        message.fileSize ||
        message.imageDetails?.fileSize ||
        message.videoDetails?.fileSize ||
        message.documentDetails?.fileSize ||
        0;

    // Resolved local file URL (from memory or IndexedDB registry)
    const [localFileUrl, setLocalFileUrl] = useState(message.fileUrl || "");

    useEffect(() => {
        let isMounted = true;
        if (message.fileId) {
            const transfer = fileTransfers?.[message.fileId];
            if (transfer?.localUrl) {
                setLocalFileUrl(transfer.localUrl);
                return;
            }
            getLocalFile(message.fileId).then((record) => {
                if (isMounted) {
                    if (record?.objectUrl) {
                        setLocalFileUrl(record.objectUrl);
                    } else if (isImage && downloadAndSaveFile) {
                        // Auto-download image so sender and receiver see the photo directly without clicking
                        const status = transfer?.status || message.fileTransferStatus;
                        if (status !== "downloading" && status !== "failed" && status !== "expired") {
                            downloadAndSaveFile({
                                fileId: message.fileId,
                                fileName,
                                fileType: "image",
                                fileSize,
                                messageId: message._id,
                                isUserGesture: false,
                            }).catch(() => {});
                        }
                    }
                }
            });
        } else if (message.fileUrl) {
            setLocalFileUrl(message.fileUrl);
        }
        return () => {
            isMounted = false;
        };
    }, [message.fileId, message.fileUrl, fileTransfers?.[message.fileId]?.localUrl, isImage]);

    // Decrypted text for quoted reply message
    const [replyText, setReplyText] = useState(() => {
        if (!message.replyTo?.text) return "";
        return message.replyTo.text.startsWith("enc:v1:") ? "" : message.replyTo.text;
    });

    useEffect(() => {
        if (!message.replyTo?.text) {
            setReplyText("");
            return;
        }

        // If the referenced message is already in messages array, use its decrypted text
        if (messages && message.replyTo._id) {
            const found = messages.find((m) => m._id === message.replyTo._id);
            if (found?.text && !found.text.startsWith("enc:v1:")) {
                setReplyText(found.text);
                return;
            }
        }

        if (message.replyTo.text.startsWith("enc:v1:")) {
            const convId =
                message.conversation?._id ||
                message.conversation ||
                selectedConversation?._id;
            if (convId) {
                decryptMessage(message.replyTo.text, convId).then((plain) => {
                    setReplyText(plain);
                });
            }
        } else {
            setReplyText(message.replyTo.text);
        }
    }, [message.replyTo?.text, message.replyTo?._id, message.conversation, selectedConversation?._id, messages]);

    const [showImagePreview, setShowImagePreview] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showExtraReactions, setShowExtraReactions] = useState(false);
    const [copied, setCopied] = useState(false);
    const reactionsRef = useRef(null);
    const menuRef = useRef(null);

    // Long press detection for mobile devices
    const touchTimerRef = useRef(null);
    const touchStartPosRef = useRef({ x: 0, y: 0 });
    const isLongPressTriggeredRef = useRef(false);

    const handleTouchStart = (e) => {
        if (message.messageType === "system") return;
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        isLongPressTriggeredRef.current = false;

        touchTimerRef.current = setTimeout(() => {
            isLongPressTriggeredRef.current = true;
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(40);
                } catch (err) {}
            }
            // Open quick reaction bar on long press
            setShowReactions(true);
            // Select message for multi-select
            if (toggleSelectMessage) {
                toggleSelectMessage(message._id);
            }
        }, 450);
    };

    const handleTouchMove = (e) => {
        if (!touchTimerRef.current) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    const handleClickMessage = (e) => {
        if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
        }
        if (isSelectionMode && toggleSelectMessage) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelectMessage(message._id);
        }
    };

    // Close delete menu or extra reactions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (reactionsRef.current && !reactionsRef.current.contains(e.target)) {
                setShowReactions(false);
                setShowExtraReactions(false);
            }
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showReactions || showMenu || showExtraReactions) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [showReactions, showMenu, showExtraReactions]);

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

    const { startCall, startGroupCall } = useContext(CallContext) || {};

    // If system audit message (e.g. user added/removed, group info/settings changed)
    if (message.messageType === "system") {
        return (
            <div className="flex items-center justify-center my-3 select-none px-4 w-full animate-in fade-in duration-200">
                <div className="max-w-md px-3.5 py-1.5 rounded-full bg-[#16162a]/95 border border-white/10 text-center text-[11px] font-medium text-zinc-300 shadow-md flex items-center justify-center gap-1.5 backdrop-blur-md">
                    <span>{message.text}</span>
                </div>
            </div>
        );
    }

    // If Call History / Log Message (1-on-1 audio/video call, missed call, group call)
    if (message.messageType === "call") {
        const details = message.callDetails || {};
        const isVideo =
            details.callType === "video" ||
            message.text?.toLowerCase().includes("video");
        const isMissed =
            details.status === "missed" ||
            message.text?.toLowerCase().includes("missed");
        const isDeclined =
            details.status === "rejected" ||
            message.text?.toLowerCase().includes("declined");
        const isGroupCallType = Boolean(
            details.isGroupCall || message.text?.toLowerCase().includes("group")
        );

        const callTitle = isGroupCallType
            ? `Group ${isVideo ? "Video" : "Audio"} Call`
            : isMissed
            ? `Missed ${isVideo ? "Video" : "Audio"} Call`
            : isDeclined
            ? `Declined ${isVideo ? "Video" : "Audio"} Call`
            : `${isVideo ? "Video" : "Audio"} Call`;

        const durationStr =
            details.duration > 0
                ? `${Math.floor(details.duration / 60)}m ${details.duration % 60}s`
                : isMissed
                ? "Missed"
                : isDeclined
                ? "Declined"
                : "";

        return (
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={handleClickMessage}
                onContextMenu={(e) => {
                    e.preventDefault();
                    toggleSelectMessage && toggleSelectMessage(message._id);
                }}
                className={`flex w-full mb-3 items-center gap-2 cursor-pointer ${
                    isMyMessage ? "justify-end" : "justify-start"
                } ${
                    isSelected
                        ? "bg-purple-600/15 rounded-2xl py-1 px-1.5"
                        : ""
                }`}
            >
                {isGroup && !isMyMessage && (
                    <Avatar
                        src={message.sender?.profilePicture}
                        name={message.sender?.name}
                        size={28}
                        className="shrink-0 mt-0.5"
                        showStatus={false}
                    />
                )}
                <div
                    className={`max-w-[85%] sm:max-w-[70%] md:max-w-[320px] rounded-2xl p-3 border select-none transition-all shadow-lg ${
                        isMyMessage
                            ? "bg-[#1d1736] border-purple-500/30 text-white rounded-tr-xs"
                            : "bg-[#151528] border-white/10 text-white rounded-tl-xs"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        {/* Call Icon Badge */}
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                                isMissed
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                            }`}
                        >
                            {isVideo ? (
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
                                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
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
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                    />
                                </svg>
                            )}
                        </div>

                        {/* Call Info */}
                        <div className="flex-1 min-w-0">
                            <h4
                                className={`text-xs font-bold truncate ${
                                    isMissed ? "text-rose-400" : "text-white"
                                }`}
                            >
                                {callTitle}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                                <span
                                    className={
                                        isMissed
                                            ? "text-rose-400 font-bold"
                                            : isMyMessage
                                            ? "text-cyan-400 font-bold"
                                            : "text-emerald-400 font-bold"
                                    }
                                >
                                    {isMissed ? "↙" : isMyMessage ? "↗" : "↙"}
                                </span>
                                <span>{durationStr || (isMissed ? "Missed" : "Call ended")}</span>
                            </div>
                        </div>

                        {/* Call Back Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isGroupCallType && startGroupCall) {
                                    startGroupCall(
                                        { _id: message.conversation },
                                        isVideo ? "video" : "audio"
                                    );
                                } else if (startCall) {
                                    const target = isMyMessage
                                        ? message.receiver
                                        : message.sender;
                                    if (target) {
                                        startCall(target, isVideo ? "video" : "audio");
                                    }
                                }
                            }}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs"
                            title="Call back"
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
                    </div>

                    {/* Bottom Time & Ticks */}
                    <div className="flex items-center justify-end gap-1 mt-2 pt-1 border-t border-white/5 text-[10px] text-zinc-400">
                        <span>{formatTime(message.createdAt)}</span>
                        {isMe && (
                            <span
                                className={
                                    (message.isSeen || message.seen)
                                        ? "tick-seen text-emerald-400 font-bold"
                                        : "text-zinc-500"
                                }
                                style={
                                    (message.isSeen || message.seen)
                                        ? { color: "#34d399" }
                                        : undefined
                                }
                            >
                                {(message.isSeen || message.seen) ? "✓✓" : (message.isDelivered || message.delivered) ? "✓✓" : "✓"}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // If message is deleted
    if (message.isDeleted || message.deletedForEveryone) {
        return (
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={handleClickMessage}
                onContextMenu={(e) => {
                    e.preventDefault();
                    toggleSelectMessage && toggleSelectMessage(message._id);
                }}
                className={`flex w-full mb-3 items-center gap-2 cursor-pointer ${
                    isMyMessage ? "justify-end" : "justify-start"
                } ${
                    isSelected
                        ? "bg-purple-600/15 rounded-2xl py-1 px-1.5"
                        : ""
                }`}
            >
                {isGroup && !isMyMessage && (
                    <Avatar
                        src={message.sender?.profilePicture}
                        name={message.sender?.name}
                        size={28}
                        className="shrink-0 mt-0.5"
                        showStatus={false}
                    />
                )}
                <div
                    className={`max-w-[85%] sm:max-w-[70%] md:max-w-[55%] rounded-2xl px-3.5 py-2.5 text-xs italic flex items-center gap-2 border select-none transition-all ${
                        isMyMessage
                            ? "bg-purple-950/20 border-purple-800/25 text-purple-300/70 rounded-tr-xs"
                            : "bg-[#141426] border-white/5 text-zinc-500 rounded-tl-xs"
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

    const transfer = (message.fileId && fileTransfers?.[message.fileId]) || {};
    const effectiveFileStatus =
        transfer.status ||
        message.fileTransferStatus ||
        (localFileUrl ? "downloaded" : "download_available");
    const effectiveProgress = typeof transfer.progress === "number" ? transfer.progress : 0;
    const effectiveLoaded = transfer.loadedBytes || 0;
    const effectiveTotal = transfer.totalBytes || message.fileSize || 0;
    const fileType = isImage ? "image" : isVideo ? "video" : "document";

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
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (isSelectionMode) {
                        toggleSelectMessage && toggleSelectMessage(message._id);
                    } else {
                        setShowMenu((prev) => !prev);
                        setShowReactions(false);
                    }
                }}
                onMouseLeave={() => {
                    if (!showMenu && !showExtraReactions) {
                        setShowReactions(false);
                    }
                }}
                className={`flex flex-col w-full mb-2 group relative transition-all ${
                    isMyMessage ? "items-end" : "items-start"
                } ${
                    isSelected
                        ? "selected-message-item bg-purple-600/15 rounded-2xl py-1 px-1.5 sm:px-2"
                        : ""
                }`}
            >
                {/* Floating Quick Emoji Reactions Pill ONLY */}
                <div
                    ref={reactionsRef}
                    className={`absolute -top-9 z-30 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#18182f]/98 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/80 text-zinc-300 transition-all duration-200 ease-out ${
                        showReactions || showExtraReactions
                            ? "opacity-100 pointer-events-auto scale-100 translate-y-0"
                            : "opacity-0 pointer-events-none scale-95 translate-y-2"
                    } ${isMyMessage ? "right-2" : "left-2"}`}
                >
                    {/* 1. WhatsApp Quick Emoji Reactions Pill */}
                    <div className="flex items-center gap-1">
                        {QUICK_REACTIONS.map((emoji) => {
                            const isReacted = reactionGroups[emoji]?.reactedByMe;
                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        onReact && onReact(message._id, emoji);
                                        setShowReactions(false);
                                        setShowExtraReactions(false);
                                    }}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-lg sm:text-xl rounded-full transition-all duration-150 ease-out transform hover:scale-135 hover:-translate-y-1 active:scale-105 cursor-pointer ${
                                        isReacted
                                            ? "bg-purple-500/30 ring-1 ring-purple-400/60 scale-110"
                                            : "hover:bg-white/10"
                                    }`}
                                    title={`React ${emoji}`}
                                >
                                    <span>{emoji}</span>
                                </button>
                            );
                        })}

                        {/* WhatsApp '+' Button to pick extra emojis */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowExtraReactions(!showExtraReactions)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer text-xs font-bold ${
                                    showExtraReactions
                                        ? "bg-purple-600 text-white scale-110"
                                        : "bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white"
                                }`}
                                title="More reactions"
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
                                        strokeWidth={2.5}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                            </button>

                            {/* Extended Emoji Tray Popup */}
                            {showExtraReactions && (
                                <div
                                    className={`absolute bottom-full mb-2.5 z-40 p-2.5 rounded-2xl bg-[#14142a]/98 backdrop-blur-xl border border-white/15 shadow-2xl animate-in fade-in zoom-in-95 duration-150 w-56 sm:w-64 grid grid-cols-6 gap-1.5 ${
                                        isMyMessage ? "right-0" : "left-0"
                                    }`}
                                >
                                    {EXTRA_REACTIONS.map((em) => {
                                        const isReacted = reactionGroups[em]?.reactedByMe;
                                        return (
                                            <button
                                                key={em}
                                                type="button"
                                                onClick={() => {
                                                    onReact && onReact(message._id, em);
                                                    setShowReactions(false);
                                                    setShowExtraReactions(false);
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center text-lg rounded-xl transition-all duration-150 transform hover:scale-130 active:scale-100 cursor-pointer ${
                                                    isReacted
                                                        ? "bg-purple-500/30 ring-1 ring-purple-400"
                                                        : "hover:bg-white/10"
                                                }`}
                                            >
                                                {em}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Message Bubble Container with Avatar for Group Chats, Selection Checkbox & Side Emoji Button */}
                <div
                    className={`flex items-center gap-2 max-w-[90%] sm:max-w-[75%] md:max-w-[65%] ${
                        isMyMessage ? "flex-row-reverse self-end" : "flex-row self-start"
                    }`}
                >
                    {isGroup && !isMyMessage && (
                        <Avatar
                            src={message.sender?.profilePicture}
                            name={message.sender?.name}
                            size={30}
                            className="shrink-0 self-start mt-0.5"
                            showStatus={false}
                        />
                    )}

                    {/* Message Bubble Card */}
                    <div
                        className={`w-full rounded-2xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-sm text-sm relative transition-all duration-200 ${
                            isMyMessage
                                ? "chat-bubble-outgoing text-white rounded-tr-xs"
                                : "bg-[#181830] text-zinc-100 rounded-tl-xs border border-white/5 shadow-black/20"
                        }`}
                        style={
                            isMyMessage
                                ? {
                                      background: "var(--accent-bubble, linear-gradient(135deg, #7c3aed, #4f46e5))",
                                      boxShadow: "var(--accent-shadow, 0 4px 14px rgba(124, 58, 237, 0.25))",
                                  }
                                : undefined
                        }
                    >
                        {/* Sender Name ONLY for received messages in Group Chat */}
                        {isGroup && !isMyMessage && message.sender?.name && (
                            <div className="text-[11px] font-semibold text-purple-300 mb-1 select-none">
                                {message.sender.name}
                            </div>
                        )}

                        {/* Forwarded Header Indicator */}
                        {message.isForwarded && (
                            <div
                                className={`flex items-center gap-1 text-[11px] italic mb-1.5 select-none ${isMyMessage ? "text-purple-200/90" : "text-zinc-400"
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
                                className={`mb-2 p-2 rounded-xl text-xs border-l-4 cursor-pointer transition-all ${isMyMessage
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
                                        (replyText ||
                                            (!message.replyTo.text?.startsWith("enc:v1:")
                                                ? message.replyTo.text
                                                : "Message") ||
                                            "Message")}
                                </div>
                            </div>
                        )}

                        {/* Voice Note Audio Attachment */}
                        {isAudio && (localFileUrl || message.fileUrl) && (
                            <div className="mb-1">
                                <AudioPlayer
                                    audioUrl={localFileUrl || message.fileUrl}
                                    duration={message.duration}
                                    isMyMessage={isMyMessage}
                                />
                            </div>
                        )}

                        {/* Image Attachment (WhatsApp-Style Circular Transfer) */}
                        {isImage && (
                            <div className="mb-2 rounded-2xl overflow-hidden relative group/img bg-black/25 border border-white/10">
                                {localFileUrl ? (
                                    <div className="relative">
                                        <img
                                            src={localFileUrl}
                                            alt={fileName}
                                            onClick={() => setShowImagePreview(true)}
                                            className="w-full max-h-80 object-cover rounded-2xl cursor-pointer transition-transform duration-200 group-hover/img:scale-[1.01]"
                                            loading="lazy"
                                        />
                                        {/* Circular upload progress overlay */}
                                        {effectiveFileStatus === "uploading" && (
                                            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                                                <CircularTransferProgress
                                                    status="uploading"
                                                    progress={effectiveProgress}
                                                    loadedBytes={effectiveLoaded}
                                                    totalBytes={effectiveTotal}
                                                    fileSize={fileSize}
                                                    size={52}
                                                    isOverlay={true}
                                                />
                                            </div>
                                        )}
                                        {effectiveFileStatus !== "uploading" && (
                                            <div
                                                onClick={() => setShowImagePreview(true)}
                                                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer hover:bg-black/85 shadow-lg backdrop-blur-xs"
                                                title="View full photo"
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
                                                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                                    />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Image Auto-Loading Placeholder with Circular Progress */
                                    <div className="w-64 sm:w-72 h-44 rounded-2xl bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 p-3 flex flex-col justify-between relative overflow-hidden">
                                        <div className="flex items-center justify-between text-xs font-semibold text-white/90">
                                            <span className="truncate max-w-[170px]">{fileName}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono">
                                                {formatBytes(fileSize)}
                                            </span>
                                        </div>

                                        <div className="my-auto flex items-center justify-center">
                                            <CircularTransferProgress
                                                status={effectiveFileStatus}
                                                progress={effectiveProgress}
                                                loadedBytes={effectiveLoaded}
                                                totalBytes={effectiveTotal}
                                                fileSize={fileSize}
                                                size={54}
                                                onStartDownload={() =>
                                                    downloadAndSaveFile?.({
                                                        fileId: message.fileId,
                                                        fileName,
                                                        fileType: "image",
                                                        fileSize,
                                                        messageId: message._id,
                                                        isUserGesture: true,
                                                    })
                                                }
                                                onRedownloadAgain={() =>
                                                    requestFileRedownload?.({
                                                        fileId: message.fileId,
                                                        fileName,
                                                        fileType: "image",
                                                        fileSize,
                                                        messageId: message._id,
                                                    })
                                                }
                                            />
                                        </div>

                                        <div className="text-[10px] text-center text-zinc-400 font-mono">
                                            {effectiveFileStatus === "downloading"
                                                ? `Loading photo... ${effectiveProgress > 0 ? `${effectiveProgress}%` : ""}`
                                                : effectiveFileStatus === "expired"
                                                ? "File is no longer available"
                                                : "Loading photo..."}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Video Attachment (WhatsApp-Style Circular Transfer) */}
                        {isVideo && (
                            <div className="mb-2 rounded-2xl overflow-hidden relative group/video bg-black/30 border border-white/10">
                                {localFileUrl ? (
                                    <div className="relative">
                                        <video
                                            src={localFileUrl}
                                            controls
                                            className="w-full max-h-80 rounded-2xl bg-black"
                                        />
                                        {effectiveFileStatus === "uploading" && (
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                                                <CircularTransferProgress
                                                    status="uploading"
                                                    progress={effectiveProgress}
                                                    loadedBytes={effectiveLoaded}
                                                    totalBytes={effectiveTotal}
                                                    fileSize={fileSize}
                                                    size={52}
                                                    isOverlay={true}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Receiver Download Card with WhatsApp Circular Progress */
                                    <div className="w-64 sm:w-72 h-44 rounded-2xl bg-gradient-to-br from-[#12162a]/95 to-zinc-950/95 p-3 flex flex-col justify-between relative overflow-hidden">
                                        <div className="flex items-center justify-between text-xs font-semibold text-white/90">
                                            <span className="truncate max-w-[170px]">{fileName}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono">
                                                {formatBytes(fileSize)}
                                            </span>
                                        </div>

                                        <div className="my-auto flex items-center justify-center">
                                            <CircularTransferProgress
                                                status={effectiveFileStatus}
                                                progress={effectiveProgress}
                                                loadedBytes={effectiveLoaded}
                                                totalBytes={effectiveTotal}
                                                fileSize={fileSize}
                                                size={54}
                                                onStartDownload={() =>
                                                    downloadAndSaveFile?.({
                                                        fileId: message.fileId,
                                                        fileName,
                                                        fileType: "video",
                                                        fileSize,
                                                        messageId: message._id,
                                                    })
                                                }
                                                onRedownloadAgain={() =>
                                                    requestFileRedownload?.({
                                                        fileId: message.fileId,
                                                        fileName,
                                                        fileType: "video",
                                                        fileSize,
                                                        messageId: message._id,
                                                    })
                                                }
                                            />
                                        </div>

                                        <div className="text-[10px] text-center text-zinc-400 font-mono">
                                            {effectiveFileStatus === "downloading"
                                                ? `Downloading video... ${effectiveProgress}%`
                                                : effectiveFileStatus === "expired"
                                                ? "File is no longer available"
                                                : "Video • Tap to download"}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Document / File Attachment (WhatsApp-Style Circular Transfer) */}
                        {isFile && (
                            <div className="flex items-center gap-3 p-3 mb-2 rounded-2xl bg-black/25 hover:bg-black/35 border border-white/10 transition-all group/doc">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
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
                                    <p className="text-xs font-semibold text-white truncate">
                                        {fileName}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                        {formatBytes(fileSize) || "Document"}
                                        {localFileUrl
                                            ? isMobileDevice()
                                                ? ` • Saved in /storage/emulated/0/ChatApp/${isMe ? "Send" : "Received"}`
                                                : ` • Saved in Downloads/ChatApp/${isMe ? "Send" : "Received"}`
                                            : ""}
                                    </p>
                                </div>

                                {localFileUrl && effectiveFileStatus !== "uploading" ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (localFileUrl) {
                                                const a = document.createElement("a");
                                                a.href = localFileUrl;
                                                a.download = fileName;
                                                a.target = "_blank";
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                            }
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-medium border border-purple-500/30 transition-all shrink-0"
                                    >
                                        Open
                                    </button>
                                ) : (
                                    <CircularTransferProgress
                                        status={effectiveFileStatus}
                                        progress={effectiveProgress}
                                        loadedBytes={effectiveLoaded}
                                        totalBytes={effectiveTotal}
                                        fileSize={fileSize}
                                        size={44}
                                        onStartDownload={() =>
                                            downloadAndSaveFile?.({
                                                fileId: message.fileId,
                                                fileName,
                                                fileType: "document",
                                                fileSize,
                                                messageId: message._id,
                                            })
                                        }
                                        onRedownloadAgain={() =>
                                            requestFileRedownload?.({
                                                fileId: message.fileId,
                                                fileName,
                                                fileType: "document",
                                                fileSize,
                                                messageId: message._id,
                                            })
                                        }
                                    />
                                )}
                            </div>
                        )}

                        {/* Message Body / Caption */}
                        {message.text && (
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-[13px] md:text-sm">
                                {renderHighlightedText(message.text, searchHighlight)}
                            </p>
                        )}

                        {/* Message Footer: Timestamp, Separate File Transfer Status & Message Ticks */}
                        <div
                            className={`flex items-center justify-end gap-1.5 mt-1 select-none text-[10px] ${
                                isMyMessage ? "text-purple-200" : "text-zinc-400"
                            }`}
                        >
                            {/* Separate File Transfer Status Indicator */}
                            {(message.fileId || isImage || isVideo || isFile) && (
                                <span className="mr-1 text-[10px] font-medium tracking-tight">
                                    {effectiveFileStatus === "uploading" ? (
                                        <span className="text-purple-300">
                                            Uploading {effectiveProgress > 0 ? `${effectiveProgress}%` : ""}
                                        </span>
                                    ) : isMe && (effectiveFileStatus === "pending_delivery" || effectiveFileStatus === "uploaded") ? (
                                        <span className="text-zinc-400/90 italic">
                                            ✓ File sent • Waiting for receiver
                                        </span>
                                    ) : isMe && effectiveFileStatus === "download_available" ? (
                                        <span className="text-emerald-400 font-medium">
                                            ✓ Delivered • Waiting for download
                                        </span>
                                    ) : effectiveFileStatus === "downloaded" ? (
                                        <span className="text-emerald-400 font-medium">
                                            Saved locally
                                        </span>
                                    ) : effectiveFileStatus === "expired" ? (
                                        <span className="text-amber-400 font-medium italic">
                                            File expired on server
                                        </span>
                                    ) : effectiveFileStatus === "checking_sender" ? (
                                        <span className="text-sky-300 font-medium italic">
                                            Checking sender...
                                        </span>
                                    ) : effectiveFileStatus === "waiting_for_sender" ? (
                                        <span className="text-sky-300 font-medium italic">
                                            Waiting for sender
                                        </span>
                                    ) : effectiveFileStatus === "unavailable" ? (
                                        <span className="text-zinc-400 italic">
                                            Unavailable
                                        </span>
                                    ) : null}
                                </span>
                            )}
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
                            {isMe && (
                                <span
                                    className={`inline-flex items-center font-mono text-xs tracking-tighter ${
                                        message.isPending || message.status === "pending"
                                            ? "text-zinc-300 opacity-80"
                                            : (message.isSeen || message.seen)
                                            ? "tick-seen text-emerald-400 font-bold"
                                            : "text-purple-200/80"
                                    }`}
                                    style={
                                        !(message.isPending || message.status === "pending") && (message.isSeen || message.seen)
                                            ? { color: "#34d399" }
                                            : undefined
                                    }
                                    title={
                                        message.isPending || message.status === "pending"
                                            ? "Waiting to send (offline)"
                                            : (message.isSeen || message.seen)
                                            ? "Read"
                                            : (message.isDelivered || message.delivered)
                                            ? "Delivered"
                                            : "Sent"
                                    }
                                >
                                    {message.isPending || message.status === "pending" ? (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-3 h-3 text-white/80 shrink-0"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <circle cx="12" cy="12" r="9" />
                                            <polyline points="12 7 12 12 15 15" />
                                        </svg>
                                    ) : (message.isSeen || message.seen) ? (
                                        "✓✓"
                                    ) : (message.isDelivered || message.delivered) ? (
                                        "✓✓"
                                    ) : (
                                        "✓"
                                    )}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Side Emoji Button on Hover (Desktop) - click opens ONLY quick reactions */}
                    {!isSelectionMode && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowReactions((prev) => !prev);
                                setShowMenu(false);
                            }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#181830]/90 hover:bg-[#252545] border border-white/15 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-all duration-150 transform active:scale-95 shadow-lg shrink-0 self-center opacity-0 group-hover:opacity-100 ${
                                showReactions
                                    ? "opacity-100 ring-2 ring-purple-500/50 bg-purple-900/40 text-white"
                                    : ""
                            }`}
                            title="React"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.75}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </button>
                    )}

                    {/* Context Menu for Message Actions (Right-Click) */}
                    {showMenu && (
                        <div
                            ref={menuRef}
                            className={`message-context-menu dropdown-menu absolute bottom-full mb-2 z-40 w-44 rounded-xl bg-[#1a1a32] border border-white/10 shadow-2xl py-1 text-xs text-zinc-200 animate-in fade-in duration-100 ${
                                isMyMessage ? "right-2" : "left-2"
                            }`}
                        >
                            {/* Reply */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onReply && onReply(message);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5 text-zinc-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                    />
                                </svg>
                                Reply
                            </button>

                            {/* Forward */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onForward && onForward(message);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5 text-zinc-400"
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
                                Forward
                            </button>

                            {/* Copy (if text) */}
                            {message.text && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        handleCopy();
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-3.5 h-3.5 text-zinc-400"
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
                                    Copy
                                </button>
                            )}

                            {/* Star / Unstar */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onToggleStar && onToggleStar(message._id);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`w-3.5 h-3.5 ${isStarredByMe ? "text-amber-400 fill-amber-400" : "text-zinc-400"}`}
                                    fill={isStarredByMe ? "currentColor" : "none"}
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
                                {isStarredByMe ? "Unstar" : "Star"}
                            </button>

                            {/* Pin / Unpin */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onTogglePin && onTogglePin(message._id);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`w-3.5 h-3.5 ${isPinned ? "text-purple-400" : "text-zinc-400"}`}
                                    fill={isPinned ? "currentColor" : "none"}
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z"
                                    />
                                </svg>
                                {isPinned ? "Unpin" : "Pin"}
                            </button>

                            <div className="h-px bg-white/10 my-1" />

                            {/* Delete */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(false);
                                    onDelete && onDelete(message._id, "forMe");
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3.5 h-3.5 text-zinc-400"
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
                                Delete for me
                            </button>
                            {isMyMessage && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onDelete && onDelete(message._id, "forEveryone");
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-red-500/15 flex items-center gap-2.5 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-3.5 h-3.5 text-red-400"
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
                                    Delete for everyone
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Reaction Badges Display */}
                {Object.keys(reactionGroups).length > 0 && (
                    <div
                        className={`flex flex-wrap gap-1 mt-1 z-10 ${isMyMessage ? "justify-end" : "justify-start"
                            } ${isGroup && !isMyMessage ? "ml-9" : ""}`}
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
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 hover:scale-105 select-none ${data.reactedByMe
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
                            href={localFileUrl || message.fileUrl || (message.fileId ? `${import.meta.env.VITE_SERVER_URL}/api/files/download/${message.fileId}` : "#")}
                            download={fileName || message.fileName || "image.png"}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
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
                            type="button"
                            onClick={() => setShowImagePreview(false)}
                            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    <img
                        src={localFileUrl || message.fileUrl || (message.fileId ? `${import.meta.env.VITE_SERVER_URL}/api/files/download/${message.fileId}` : "")}
                        alt={fileName || "Full Preview"}
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                    />

                    {fileName && (
                        <p className="text-xs text-zinc-400 mt-3 font-mono">
                            {fileName}
                        </p>
                    )}
                </div>
            )}
        </>
    );
};

export default MessageBubble;
