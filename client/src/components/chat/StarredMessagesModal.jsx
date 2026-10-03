import React, { useState, useEffect, useContext } from "react";
import Modal from "../common/Modal";
import Avatar from "../common/Avatar";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

export const StarredMessagesModal = ({
    isOpen,
    onClose,
    conversationId,
    onJumpToMessage,
}) => {
    const { user } = useContext(AuthContext);
    const { getStarredMessages, toggleStarMessage } = useContext(ChatContext);

    const [filterScope, setFilterScope] = useState("current"); // "current" | "all"
    const [starredList, setStarredList] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchStarred = async () => {
        try {
            setLoading(true);
            const targetConvId = filterScope === "current" ? conversationId : null;
            const data = await getStarredMessages(targetConvId);
            setStarredList(data);
        } catch (err) {
            console.error("Failed to load starred messages:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchStarred();
        }
    }, [isOpen, filterScope, conversationId]);

    const handleUnstar = async (msgId) => {
        await toggleStarMessage(msgId);
        setStarredList((prev) => prev.filter((m) => m._id !== msgId));
    };

    const handleJump = (msg) => {
        onClose();
        if (onJumpToMessage) {
            onJumpToMessage(msg._id, msg.conversation?._id || msg.conversation);
        }
    };

    const formatTime = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return d.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Starred Messages"
            subtitle="Quickly access all your bookmarked messages"
            maxWidth="max-w-xl"
        >
            <div className="flex flex-col h-[480px]">
                {/* Scope Filter Tabs */}
                {conversationId && (
                    <div className="flex items-center gap-2 mb-4 p-1 rounded-xl bg-[#16162a] border border-white/5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setFilterScope("current")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                filterScope === "current"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                    : "text-zinc-400 hover:text-white"
                            }`}
                        >
                            This Chat
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterScope("all")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                filterScope === "all"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                                    : "text-zinc-400 hover:text-white"
                            }`}
                        >
                            All Chats
                        </button>
                    </div>
                )}

                {/* Starred Messages List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            Loading starred messages...
                        </div>
                    ) : starredList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-12">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
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
                                        strokeWidth={1.5}
                                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-200">
                                    No starred messages
                                </h4>
                                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                                    Hover over any message in chat and click the Star icon (⭐) to bookmark it here.
                                </p>
                            </div>
                        </div>
                    ) : (
                        starredList.map((msg) => {
                            const isMe = msg.sender?._id === user?._id;
                            const isAudio =
                                msg.messageType === "audio" ||
                                (msg.fileUrl &&
                                    (msg.fileUrl.startsWith("data:audio") ||
                                        msg.fileUrl.includes("audio/")));
                            const isImage =
                                msg.messageType === "image" ||
                                (msg.fileUrl &&
                                    (msg.fileUrl.startsWith("data:image") ||
                                        msg.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)));
                            const isFile =
                                msg.messageType === "file" ||
                                (msg.fileUrl && !isImage && !isAudio);

                            return (
                                <div
                                    key={msg._id}
                                    className="p-3 rounded-2xl bg-[#16162a] border border-white/5 hover:border-white/10 transition-all flex flex-col gap-2 group"
                                >
                                    {/* Header: Sender & Meta */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Avatar
                                                src={msg.sender?.profilePicture}
                                                name={msg.sender?.name}
                                                size={24}
                                            />
                                            <span className="text-xs font-semibold text-white truncate">
                                                {isMe ? "You" : msg.sender?.name || "User"}
                                            </span>
                                            {filterScope === "all" && msg.conversation?.isGroup && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 truncate">
                                                    {msg.conversation?.groupName || "Group"}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                {formatTime(msg.createdAt)}
                                            </span>

                                            {/* Unstar Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleUnstar(msg._id)}
                                                className="w-6 h-6 rounded-lg flex items-center justify-center text-amber-400 hover:text-zinc-400 hover:bg-white/5 transition-colors"
                                                title="Unstar message"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="w-3.5 h-3.5 fill-amber-400"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={1}
                                                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Preview */}
                                    <div className="text-xs text-zinc-300 pl-8">
                                        {/* Image Preview */}
                                        {isImage && msg.fileUrl && (
                                            <div className="mb-1.5 max-w-[200px] rounded-xl overflow-hidden border border-white/10">
                                                <img
                                                    src={msg.fileUrl}
                                                    alt="Starred attachment"
                                                    className="w-full max-h-32 object-cover"
                                                />
                                            </div>
                                        )}

                                        {/* Audio Voice Note Indicator */}
                                        {isAudio && (
                                            <div className="flex items-center gap-2 mb-1.5 text-purple-300 font-medium text-xs">
                                                <span>🎙️ Voice Note</span>
                                                {msg.duration > 0 && (
                                                    <span className="text-[10px] text-zinc-500 font-mono">
                                                        ({Math.round(msg.duration)}s)
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* File Attachment Indicator */}
                                        {isFile && (
                                            <div className="flex items-center gap-2 mb-1.5 text-zinc-300 text-xs">
                                                <span>📄 {msg.fileName || "Attachment document"}</span>
                                            </div>
                                        )}

                                        {/* Text */}
                                        {msg.text && (
                                            <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                                {msg.text.startsWith("enc:v1:")
                                                    ? "🔒 Encrypted Message"
                                                    : msg.text}
                                            </p>
                                        )}
                                    </div>

                                    {/* Footer: Jump Action */}
                                    <div className="flex justify-end pt-1">
                                        <button
                                            type="button"
                                            onClick={() => handleJump(msg)}
                                            className="text-[11px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors"
                                        >
                                            Jump to message
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
                                                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default StarredMessagesModal;
