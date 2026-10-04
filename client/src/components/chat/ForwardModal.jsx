import React, { useContext, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import Avatar from "../common/Avatar";

export const ForwardModal = ({ isOpen, message, messages: multiMessages, onClose }) => {
    const { conversations, forwardMessage } = useContext(ChatContext);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSending, setIsSending] = useState(false);

    const msgsList = Array.isArray(message)
        ? message
        : Array.isArray(multiMessages)
        ? multiMessages
        : message
        ? [message]
        : [];

    if (!isOpen || msgsList.length === 0) return null;

    const handleToggleSelect = (convId) => {
        setSelectedIds((prev) =>
            prev.includes(convId)
                ? prev.filter((id) => id !== convId)
                : [...prev, convId]
        );
    };

    const handleForward = async () => {
        if (selectedIds.length === 0 || isSending) return;
        try {
            setIsSending(true);
            for (const msg of msgsList) {
                await forwardMessage(msg, selectedIds);
            }
            setSelectedIds([]);
            onClose();
        } catch (err) {
            console.error("Forward error:", err);
            alert("Failed to forward message");
        } finally {
            setIsSending(false);
        }
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredConversations = conversations.filter((c) => {
        if (!normalizedQuery) return true;
        const name = c.user?.name || c.groupName || "";
        const phone = c.user?.phone || "";
        return (
            name.toLowerCase().includes(normalizedQuery) ||
            phone.includes(normalizedQuery)
        );
    });

    const getPreviewText = () => {
        if (msgsList.length > 1) {
            return `${msgsList.length} messages selected`;
        }
        const single = msgsList[0];
        if (!single) return "Message";
        if (single.text) return single.text;
        if (single.messageType === "audio") return "🎤 Voice message";
        if (single.messageType === "image") return "📷 Photo";
        if (single.messageType === "file") return `📄 ${single.fileName || "Document"}`;
        return "Message";
    };

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-[#14142a] border border-purple-500/25 rounded-3xl shadow-2xl shadow-purple-950/40 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-150 relative"
            >
                {/* Modal Header */}
                <div className="p-4 px-5 border-b border-white/10 flex items-center justify-between bg-[#181832]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
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
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">
                                Forward Message
                            </h3>
                            <p className="text-[11px] text-zinc-400">
                                Select contacts or groups
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Message Preview Snippet */}
                <div className="px-5 py-2.5 bg-purple-950/20 border-b border-purple-500/15 flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-purple-500 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">
                            Forwarding
                        </span>
                        <p className="text-xs text-zinc-300 truncate font-normal">
                            {getPreviewText()}
                        </p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 px-5 border-b border-white/5 bg-[#121224]">
                    <div className="relative flex items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3.5 h-3.5 text-zinc-400 absolute left-3"
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
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats to forward to..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1b1b36] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-all"
                        />
                    </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto divide-y divide-white/5 min-h-[200px]">
                    {filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-xs text-zinc-500">
                            No chats found
                        </div>
                    ) : (
                        filteredConversations.map((conv) => {
                            const isSelected = selectedIds.includes(conv._id);
                            const name = conv.user?.name || conv.groupName || "Unnamed";
                            const pic = conv.user?.profilePicture || conv.groupAvatar;

                            return (
                                <div
                                    key={conv._id}
                                    onClick={() => handleToggleSelect(conv._id)}
                                    className={`flex items-center justify-between p-3 px-5 hover:bg-white/[0.04] transition-all cursor-pointer ${
                                        isSelected ? "bg-purple-900/15" : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {conv.isGroup ? (
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 overflow-hidden">
                                                {conv.groupAvatar ? (
                                                    conv.groupAvatar.startsWith("http") ||
                                                    conv.groupAvatar.startsWith("data:") ? (
                                                        <img
                                                            src={conv.groupAvatar}
                                                            alt={name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-base leading-none">{conv.groupAvatar}</span>
                                                    )
                                                ) : (
                                                    <span>👥</span>
                                                )}
                                            </div>
                                        ) : (
                                            <Avatar
                                                src={pic}
                                                name={name}
                                                size={40}
                                                isOnline={conv.user?.isOnline}
                                            />
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="text-xs font-semibold text-white truncate">
                                                    {name}
                                                </h4>
                                                {conv.isGroup && (
                                                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-medium border border-purple-500/30 shrink-0">
                                                        Group
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                                {conv.isGroup
                                                    ? `${conv.participants?.length || 0} members`
                                                    : conv.user?.phone || "Chat"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Selection Checkbox */}
                                    <div
                                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                            isSelected
                                                ? "bg-purple-600 border-purple-500 text-white"
                                                : "border-white/20 bg-white/5"
                                        }`}
                                    >
                                        {isSelected && (
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="w-3.5 h-3.5"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Send Action */}
                <div className="p-3.5 px-5 border-t border-white/10 bg-[#16162e] flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">
                        {selectedIds.length > 0 ? (
                            <span className="text-purple-300 font-semibold">
                                {selectedIds.length} {selectedIds.length === 1 ? "chat" : "chats"} selected
                            </span>
                        ) : (
                            "Select at least one chat"
                        )}
                    </span>

                    <button
                        onClick={handleForward}
                        disabled={selectedIds.length === 0 || isSending}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-semibold shadow-lg shadow-purple-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                        {isSending ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
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
                                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                            </svg>
                        )}
                        <span>Forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
