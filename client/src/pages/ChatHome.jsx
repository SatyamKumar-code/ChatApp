import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

// Modular Components
import NavigationRail from "../components/sidebar/NavigationRail";
import ChatList from "../components/sidebar/ChatList";
import StatusList from "../components/sidebar/StatusList";
import CallHistoryList from "../components/sidebar/CallHistoryList";
import ContactList from "../components/sidebar/ContactList";
import AddContactModal from "../components/sidebar/AddContactModal";
import CreateGroupModal from "../components/chat/CreateGroupModal";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import EmptyChat from "../components/chat/EmptyChat";
import ProfilePanel from "../components/profile/ProfilePanel";
import SettingsModal from "../components/settings/SettingsModal";
import StarredMessagesModal from "../components/chat/StarredMessagesModal";
import EncryptionVerifyModal from "../components/chat/EncryptionVerifyModal";
import IncomingCallModal from "../components/call/IncomingCallModal";
import CallModal from "../components/call/CallModal";
import PinnedMessageBanner from "../components/chat/PinnedMessageBanner";
import ForwardModal from "../components/chat/ForwardModal";
import ChatThemeModal, { CHAT_THEMES } from "../components/chat/ChatThemeModal";
import { useTheme } from "../context/ThemeContext";

export const ChatHome = () => {
    const { user } = useContext(AuthContext);
    const { isLight } = useTheme();
    const {
        conversations,
        selectedConversation,
        selectConversation,
        messages,
        messagesLoading,
        sendMessage,
        startTyping,
        stopTyping,
        typingUsers,
        togglePinMessage,
        clearChat,
        deleteConversation,
        leaveOrRemoveGroupMember,
        toggleBlockUser,
        isUserBlocked,
        blockedUsers,
    } = useContext(ChatContext);

    // Active Navigation Tab: 'chats' | 'contacts'
    const [activeTab, setActiveTab] = useState("chats");

    // Modal & Drawer States
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isStarredOpen, setIsStarredOpen] = useState(false);
    const [isVerifyEncryptionOpen, setIsVerifyEncryptionOpen] = useState(false);
    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [forwardingMessage, setForwardingMessage] = useState(null);

    // Chat Theme State
    const [currentThemeId, setCurrentThemeId] = useState(() => {
        return localStorage.getItem("chatapp_global_theme") || "default";
    });

    const activeTheme = React.useMemo(() => {
        const found = CHAT_THEMES.find((t) => t.id === currentThemeId) || CHAT_THEMES[0];
        if (isLight && found.id === "default") {
            return {
                ...found,
                style: { background: "var(--bg-chat, #b0b9c4)" },
            };
        }
        return found;
    }, [currentThemeId, isLight]);

    const handleSelectTheme = (themeId) => {
        setCurrentThemeId(themeId);
        localStorage.setItem("chatapp_global_theme", themeId);
    };

    // Custom Wallpaper Image State
    const [customWallpaper, setCustomWallpaper] = useState(() => {
        return localStorage.getItem("chatapp_custom_wallpaper") || "";
    });

    const [wallpaperOpacity, setWallpaperOpacity] = useState(() => {
        const saved = localStorage.getItem("chatapp_wallpaper_opacity");
        return saved !== null ? Number(saved) : 0.45;
    });

    const handleSetCustomWallpaper = (val) => {
        setCustomWallpaper(val);
        if (val) {
            localStorage.setItem("chatapp_custom_wallpaper", val);
        } else {
            localStorage.removeItem("chatapp_custom_wallpaper");
        }
    };

    const handleSetWallpaperOpacity = (val) => {
        setWallpaperOpacity(val);
        localStorage.setItem("chatapp_wallpaper_opacity", String(val));
    };

    // Muted Chats State
    const [mutedChats, setMutedChats] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("chatapp_muted_chats") || "[]");
        } catch {
            return [];
        }
    });

    const isCurrentChatMuted = Boolean(
        selectedConversation?._id && mutedChats.includes(selectedConversation._id)
    );

    const handleToggleMuteCurrentChat = () => {
        if (!selectedConversation?._id) return;
        const convId = selectedConversation._id;
        const nextMuted = isCurrentChatMuted
            ? mutedChats.filter((id) => id !== convId)
            : [...mutedChats, convId];
        setMutedChats(nextMuted);
        localStorage.setItem("chatapp_muted_chats", JSON.stringify(nextMuted));
    };

    // Blocked status
    const partnerId = selectedConversation?.user?._id?.toString();
    const isCurrentContactBlocked = Boolean(partnerId && isUserBlocked(partnerId));

    const handleDeleteCurrentGroupChat = async () => {
        if (!selectedConversation?._id) return;
        const confirmDelete = window.confirm("Are you sure you want to delete this group chat history?");
        if (!confirmDelete) return;
        try {
            await deleteConversation(selectedConversation._id);
        } catch (err) {
            console.error("Failed to delete group chat:", err);
            alert("Failed to delete group chat");
        }
    };

    const handleBlockOrLeaveCurrentChat = async () => {
        if (!selectedConversation) return;

        if (selectedConversation.isGroup) {
            if (selectedConversation.isLeft || selectedConversation.user?.isLeft) {
                return handleDeleteCurrentGroupChat();
            }
            const confirmLeave = window.confirm("Are you sure you want to leave this group?");
            if (!confirmLeave) return;
            try {
                await leaveOrRemoveGroupMember(selectedConversation._id, user._id);
            } catch (err) {
                console.error("Failed to leave group:", err);
                alert(err.response?.data?.message || "Failed to leave group");
            }
            return;
        }

        if (!partnerId) return;
        if (isCurrentContactBlocked) {
            try {
                await toggleBlockUser(partnerId);
                alert(`${selectedConversation.user?.name || "Contact"} has been unblocked.`);
            } catch (err) {
                console.error("Failed to unblock:", err);
                alert(err.response?.data?.message || "Failed to unblock contact");
            }
        } else {
            const confirmBlock = window.confirm(
                `Are you sure you want to block ${selectedConversation.user?.name || "this contact"}?`
            );
            if (!confirmBlock) return;
            try {
                await toggleBlockUser(partnerId);
                alert(`${selectedConversation.user?.name || "Contact"} has been blocked.`);
            } catch (err) {
                console.error("Failed to block:", err);
                alert(err.response?.data?.message || "Failed to block contact");
            }
        }
    };

    // Clear Chat Handler
    const handleClearCurrentChat = async () => {
        if (!selectedConversation?._id) return;
        const confirmClear = window.confirm(
            "Are you sure you want to clear all messages in this conversation?"
        );
        if (!confirmClear) return;

        try {
            await clearChat(selectedConversation._id);
        } catch (err) {
            console.error("Failed to clear chat:", err);
            alert("Failed to clear chat messages");
        }
    };

    // In-Chat Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    // Compute matching messages within active chat
    const matchingMessages = React.useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return messages.filter(
            (msg) =>
                !msg.isDeleted &&
                !msg.deletedForEveryone &&
                ((msg.text && msg.text.toLowerCase().includes(term)) ||
                 (msg.fileName && msg.fileName.toLowerCase().includes(term)))
        );
    }, [messages, searchTerm]);

    // Reset search when switching conversations
    React.useEffect(() => {
        setIsSearching(false);
        setSearchTerm("");
        setCurrentMatchIndex(0);
    }, [selectedConversation?._id]);

    // Jump to match in message list
    const jumpToMatch = (index) => {
        if (!matchingMessages.length) return;
        const targetMsg = matchingMessages[index];
        if (!targetMsg) return;
        const el = document.getElementById(`msg-${targetMsg._id}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-amber-400", "rounded-2xl", "transition-all");
            setTimeout(() => {
                el.classList.remove("ring-2", "ring-amber-400");
            }, 1800);
        }
    };

    const handleNextMatch = () => {
        if (matchingMessages.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % matchingMessages.length;
        setCurrentMatchIndex(nextIndex);
        jumpToMatch(nextIndex);
    };

    const handlePrevMatch = () => {
        if (matchingMessages.length === 0) return;
        const prevIndex =
            (currentMatchIndex - 1 + matchingMessages.length) % matchingMessages.length;
        setCurrentMatchIndex(prevIndex);
        jumpToMatch(prevIndex);
    };

    React.useEffect(() => {
        if (matchingMessages.length > 0) {
            setCurrentMatchIndex(0);
            jumpToMatch(0);
        }
    }, [searchTerm]);

    // Jump directly to starred message (switching conversation if necessary)
    const handleJumpToStarredMessage = async (msgId, convId) => {
        if (convId && (!selectedConversation || selectedConversation._id !== convId)) {
            const targetConv = conversations.find((c) => c._id === convId);
            if (targetConv) {
                await selectConversation(targetConv);
            }
        }
        setTimeout(() => {
            const el = document.getElementById(`msg-${msgId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-amber-400", "rounded-2xl", "transition-all");
                setTimeout(() => {
                    el.classList.remove("ring-2", "ring-amber-400");
                }, 2000);
            }
        }, 350);
    };

    // Calculate total unread count
    const totalUnread = conversations.reduce((acc, conv) => {
        const lastMsg = conv.lastMessage;
        if (lastMsg && !lastMsg.isSeen && lastMsg.sender !== user?._id) {
            return acc + 1;
        }
        return acc;
    }, 0);

    // Typing status text for active chat
    const getTypingText = () => {
        if (!selectedConversation) return null;
        const typing = typingUsers[selectedConversation._id];
        if (!typing) return null;
        return `${typing.userName || "User"} is typing...`;
    };

    // Handle sending a message
    const handleSendMessage = async (payload) => {
        if (!payload || !selectedConversation) return;
        try {
            setIsSending(true);
            await sendMessage(payload);
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans antialiased transition-colors duration-200">
            {/* 1. Left Icon Navigation Rail */}
            <NavigationRail
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenSettings={() => setIsSettingsOpen(true)}
                unreadTotal={totalUnread}
            />

            {/* 2. Conversations / Status / Calls Sidebar */}
            <div
                className={`w-full md:w-80 lg:w-96 shrink-0 h-full flex flex-col ${selectedConversation ? "hidden md:flex" : "flex"
                    }`}
            >
                {activeTab === "status" ? (
                    <StatusList
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                ) : activeTab === "calls" ? (
                    <CallHistoryList
                        onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                ) : (
                    <ChatList
                        onSelectChat={() => setIsProfilePanelOpen(false)}
                        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        unreadTotal={totalUnread}
                    />
                )}
            </div>

            {/* 3. Main Chat View */}
            <div
                className={`flex-1 flex flex-col h-full min-w-0 transition-colors duration-300 relative overflow-hidden ${!selectedConversation ? "hidden md:flex" : "flex"
                    }`}
                style={activeTheme.style}
            >
                {/* Custom Wallpaper Image Overlay */}
                {customWallpaper && (
                    <div
                        className="absolute inset-0 bg-cover bg-center pointer-events-none z-0 transition-opacity duration-300"
                        style={{
                            backgroundImage: `url(${customWallpaper})`,
                            opacity: wallpaperOpacity,
                        }}
                    />
                )}

                {selectedConversation ? (
                    <div className="flex-1 flex flex-col h-full min-w-0 relative z-1">
                        {/* Header */}
                        <ChatHeader
                            partner={selectedConversation.user}
                            isTyping={Boolean(typingUsers[selectedConversation._id])}
                            onToggleProfile={() =>
                                setIsProfilePanelOpen(!isProfilePanelOpen)
                            }
                            isProfileOpen={isProfilePanelOpen}
                            onBack={() => selectConversation(null)}
                            isSearching={isSearching}
                            setIsSearching={setIsSearching}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            matchesCount={matchingMessages.length}
                            currentMatchIndex={currentMatchIndex}
                            onNextMatch={handleNextMatch}
                            onPrevMatch={handlePrevMatch}
                            onOpenStarred={() => setIsStarredOpen(true)}
                            onOpenChatTheme={() => setIsThemeModalOpen(true)}
                            isMuted={isCurrentChatMuted}
                            onToggleMute={handleToggleMuteCurrentChat}
                            onClearChat={handleClearCurrentChat}
                            onBlockContact={handleBlockOrLeaveCurrentChat}
                            isBlocked={isCurrentContactBlocked}
                            onForwardSelected={(selectedMsgs) => setForwardingMessage(selectedMsgs)}
                        />

                        {/* Pinned Message Banner */}
                        <PinnedMessageBanner
                            pinnedMessages={selectedConversation.pinnedMessages}
                            onUnpin={togglePinMessage}
                            onJumpToMessage={(msgId) => {
                                const el = document.getElementById(`msg-${msgId}`);
                                if (el) {
                                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                                    el.classList.add("ring-2", "ring-purple-400", "rounded-2xl");
                                    setTimeout(() => {
                                        el.classList.remove("ring-2", "ring-purple-400", "rounded-2xl");
                                    }, 2000);
                                }
                            }}
                        />

                        {/* Message History */}
                        <MessageList
                            messages={messages}
                            messagesLoading={messagesLoading}
                            typingText={getTypingText()}
                            searchTerm={searchTerm}
                            onOpenVerifyEncryption={() => setIsVerifyEncryptionOpen(true)}
                            onForward={(msg) => setForwardingMessage(msg)}
                        />

                        {/* Blocked Contact Info Bar (Notice only, user can still message) */}
                        {isCurrentContactBlocked && (
                            <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/20 backdrop-blur-xs flex items-center justify-between gap-3 text-xs text-rose-300 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm">🚫</span>
                                    <span className="truncate">
                                        You have blocked this contact. You will not receive any new messages from them.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleBlockOrLeaveCurrentChat}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white font-medium text-[11px] transition-all cursor-pointer shrink-0"
                                >
                                    Unblock
                                </button>
                            </div>
                        )}

                        {/* Notice for user who is blocked by other */}
                        {!isCurrentContactBlocked && selectedConversation.user?.isBlockedByOther && (
                            <div className="px-4 py-2 bg-zinc-900/90 border-t border-white/10 backdrop-blur-xs flex items-center gap-2 text-xs text-zinc-400 animate-in fade-in duration-150">
                                <span className="text-sm">🚫</span>
                                <span className="truncate">
                                    You have been blocked by this user.
                                </span>
                            </div>
                        )}

                        {/* Message Input Box or Left Group Read-Only Notice */}
                        {(() => {
                            const isGroupChat = Boolean(selectedConversation?.isGroup);
                            const isLeftGroup = isGroupChat && Boolean(selectedConversation?.isLeft || selectedConversation?.user?.isLeft);

                            if (isLeftGroup) {
                                return (
                                    <div className="p-4 bg-[#121224]/70 border-t border-white/10 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                                        <div className="flex items-center gap-2 text-zinc-300">
                                            <span className="text-base">🚫</span>
                                            <span>You can't send messages to this group because you're no longer a participant.</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDeleteCurrentGroupChat}
                                            className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shrink-0"
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
                                            <span>Delete Group</span>
                                        </button>
                                    </div>
                                );
                            }

                            const groupAdminId =
                                selectedConversation?.groupAdmin?._id ||
                                selectedConversation?.groupAdmin;
                            const groupAdminsList = selectedConversation?.groupAdmins || [];
                            const isCurrentUserAdmin =
                                isGroupChat &&
                                Boolean(
                                    (groupAdminId && (groupAdminId._id || groupAdminId).toString() === user?._id?.toString()) ||
                                    groupAdminsList.some((a) => (a?._id || a)?.toString() === user?._id?.toString())
                                );
                            const onlyAdminsCanSend = Boolean(
                                selectedConversation?.groupSettings?.onlyAdminsCanSendMessages
                            );
                            const isMessagingBlocked = isGroupChat && onlyAdminsCanSend && !isCurrentUserAdmin;

                            return (
                                <MessageInput
                                    onSendMessage={handleSendMessage}
                                    onTyping={startTyping}
                                    onStopTyping={stopTyping}
                                    disabled={isSending || isMessagingBlocked}
                                    disabledReason={isMessagingBlocked ? "Only admins can send messages in this group" : ""}
                                />
                            );
                        })()}
                    </div>
                ) : (
                    <EmptyChat
                        onOpenGroups={() => setActiveTab("groups")}
                        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                    />
                )}
            </div>

            {/* 4. Right Contact Detail Drawer (Desktop & Mobile Drawer) */}
            {selectedConversation && isProfilePanelOpen && (
                <>
                    <div
                        onClick={() => setIsProfilePanelOpen(false)}
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-35 animate-in fade-in duration-200"
                    />
                    <ProfilePanel
                        partner={selectedConversation.user}
                        conversation={selectedConversation}
                        onClose={() => setIsProfilePanelOpen(false)}
                        onOpenVerifyEncryption={() => setIsVerifyEncryptionOpen(true)}
                    />
                </>
            )}

            {/* 5. Settings Modal (Includes Profile Photo Upload, Appearance, Privacy, Account) */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            {/* 6. Starred Messages Modal */}
            <StarredMessagesModal
                isOpen={isStarredOpen}
                onClose={() => setIsStarredOpen(false)}
                conversationId={selectedConversation?._id}
                onJumpToMessage={handleJumpToStarredMessage}
            />

            {/* 7. Verify End-to-End Encryption Modal */}
            <EncryptionVerifyModal
                isOpen={isVerifyEncryptionOpen}
                onClose={() => setIsVerifyEncryptionOpen(false)}
                conversation={selectedConversation}
                partner={selectedConversation?.user}
            />

            {/* 8. Add Contact Modal */}
            <AddContactModal
                isOpen={isAddContactOpen}
                onClose={() => setIsAddContactOpen(false)}
            />

            {/* 9. Create Group Modal */}
            <CreateGroupModal
                isOpen={isCreateGroupOpen}
                onClose={() => setIsCreateGroupOpen(false)}
            />

            {/* 10. WebRTC Audio & Video Calling Overlays */}
            <IncomingCallModal />
            <CallModal />

            {/* 11. Forward Message Modal */}
            <ForwardModal
                isOpen={Boolean(forwardingMessage)}
                message={forwardingMessage}
                onClose={() => setForwardingMessage(null)}
            />

            {/* 12. Chat Theme / Wallpaper Modal */}
            <ChatThemeModal
                isOpen={isThemeModalOpen}
                onClose={() => setIsThemeModalOpen(false)}
                currentThemeId={currentThemeId}
                onSelectTheme={handleSelectTheme}
                customWallpaper={customWallpaper}
                onSetCustomWallpaper={handleSetCustomWallpaper}
                wallpaperOpacity={wallpaperOpacity}
                onSetWallpaperOpacity={handleSetWallpaperOpacity}
            />

            {/* 12. Mobile Bottom Navigation Bar (Visible only on mobile when list is active) */}
            {!selectedConversation && (
                <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#0c0c18]/95 backdrop-blur-lg border-t border-white/10 px-4 py-1.5 flex items-center justify-around z-30 shadow-2xl">
                    {/* Chats Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("chats")}
                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === "chats"
                                ? "text-purple-400 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <div className="relative">
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
                                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                                />
                            </svg>
                            {totalUnread > 0 && (
                                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-[#0c0c18]">
                                    {totalUnread > 9 ? "9+" : totalUnread}
                                </span>
                            )}
                        </div>
                        <span className="text-[11px]">Chats</span>
                    </button>

                    {/* Groups Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("groups")}
                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === "groups"
                                ? "text-purple-400 font-semibold"
                                : "text-zinc-400 hover:text-white"
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
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                        <span className="text-[11px]">Groups</span>
                    </button>

                    {/* Status Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("status")}
                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === "status"
                                ? "text-purple-400 font-semibold"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        <span className="text-lg leading-5">✨</span>
                        <span className="text-[11px]">Status</span>
                    </button>

                    {/* Calls Tab */}
                    <button
                        type="button"
                        onClick={() => setActiveTab("calls")}
                        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
                            activeTab === "calls"
                                ? "text-purple-400 font-semibold"
                                : "text-zinc-400 hover:text-white"
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
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                        </svg>
                        <span className="text-[11px]">Calls</span>
                    </button>
                </nav>
            )}
        </div>
    );
};

export default ChatHome;