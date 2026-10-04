import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { useTheme, THEME_MODES } from "../../context/ThemeContext";
import Avatar from "../common/Avatar";
import InviteModal from "../common/InviteModal";
import { usePwa } from "../../context/PwaContext";

export const ChatList = ({
    onSelectChat,
    onOpenCreateGroup,
    onOpenSettings,
    activeTab = "chats",
    setActiveTab,
    unreadTotal = 0,
}) => {
    const { user } = useContext(AuthContext);
    const { themeMode, changeThemeMode, resolvedTheme } = useTheme();
    const {
        conversations,
        loading,
        selectedConversation,
        selectConversation,
        openConversation,
        searchUsers,
        typingUsers,
        togglePinConversation,
    } = useContext(ChatContext);
    const { isInstalled, canPromptDirectly, triggerInstall, openInstallModal } = usePwa();

    const isGroupsView = activeTab === "groups";

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all"); // 'all' | 'unread' | 'direct' | 'groups'

    // Reset filter when tab changes
    useEffect(() => {
        setFilterType("all");
    }, [activeTab]);

    // Database search states
    const [dbUsers, setDbUsers] = useState([]);
    const [searchingDb, setSearchingDb] = useState(false);
    const [startingChatId, setStartingChatId] = useState(null);

    // Invite modal state
    const [invitePhone, setInvitePhone] = useState("");
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // Format chat timestamp
    const formatChatTime = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 86400000 && d.getDate() === now.getDate()) {
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        }
        if (diff < 604800000) {
            return d.toLocaleDateString([], { weekday: "short" });
        }
        return d.toLocaleDateString([], {
            month: "short",
            day: "numeric",
        });
    };

    // 1. Existing conversation search (Check if already messaged / active chat)
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const cleanPhone = searchQuery.replace(/\D/g, "");
    const cleanDigits = cleanPhone;

    // Filter base conversations by tab (groups tab vs all chats)
    const baseConversations = isGroupsView
        ? conversations.filter((conv) => conv.isGroup)
        : conversations;

    const existingMatches = baseConversations.filter((conv) => {
        if (!normalizedQuery) return true;
        const partner = conv.user;
        if (!partner) return false;

        const nameMatch = partner.name?.toLowerCase().includes(normalizedQuery);
        const phoneMatch = partner.phone?.includes(cleanDigits || normalizedQuery);

        return nameMatch || phoneMatch;
    });

    // Apply filter pills on existing conversations if no search query
    const displayedConversations = !normalizedQuery
        ? existingMatches.filter((conv) => {
              if (filterType === "unread") {
                  const lastMsg = conv.lastMessage;
                  return (
                      lastMsg && !lastMsg.isSeen && lastMsg.sender !== user?._id
                  );
              }
              if (filterType === "direct") {
                  return !conv.isGroup;
              }
              if (filterType === "groups") {
                  return Boolean(conv.isGroup);
              }
              return true;
          })
        : existingMatches;

    // 2. Database direct lookup (when searching)
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query || query.length < 2) {
            setDbUsers([]);
            setSearchingDb(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearchingDb(true);
                const results = await searchUsers(query);

                // Filter out users who are already in our existing conversations
                const existingUserIds = new Set(
                    conversations
                        .map((c) => c.user?._id?.toString())
                        .filter(Boolean)
                );

                const newUsers = (results || []).filter(
                    (u) => !existingUserIds.has(u._id?.toString())
                );

                setDbUsers(newUsers);
            } catch (err) {
                console.error("Search DB users error:", err);
                setDbUsers([]);
            } finally {
                setSearchingDb(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, conversations, searchUsers]);

    // Check if phone search has matches
    const isPhoneQuery = cleanDigits.length >= 7;
    const hasExistingPhoneMatch = existingMatches.some((c) => {
        const pPhone = c.user?.phone?.replace(/\D/g, "") || "";
        return pPhone.includes(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.includes(pPhone));
    });
    const hasDbPhoneMatch = dbUsers.some((u) => {
        const uPhone = u.phone?.replace(/\D/g, "") || "";
        return uPhone.includes(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.includes(uPhone));
    });

    const showInviteCard = isPhoneQuery && !hasExistingPhoneMatch && !hasDbPhoneMatch && !searchingDb;

    // Handle clicking existing conversation
    const handleItemClick = (conv) => {
        selectConversation(conv);
        onSelectChat?.(conv);
    };

    // Handle starting direct chat with registered database user
    const handleStartDirectChat = async (targetUser) => {
        if (!targetUser?._id) return;
        try {
            setStartingChatId(targetUser._id);
            const conversation = await openConversation(targetUser._id);
            if (conversation) {
                await selectConversation(conversation);
                onSelectChat?.(conversation);
                setSearchQuery("");
                setDbUsers([]);
            }
        } catch (error) {
            console.error("Direct chat error:", error);
        } finally {
            setStartingChatId(null);
        }
    };

    // Handle open invite
    const handleOpenInvite = () => {
        setInvitePhone(cleanDigits || searchQuery);
        setIsInviteModalOpen(true);
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f1c] select-none h-full border-r border-white/5">
            {/* Header */}
            <div className="px-4 md:px-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-5 pb-3 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        {/* Mobile profile avatar quick click */}
                        {onOpenSettings && (
                            <div
                                onClick={onOpenSettings}
                                className="md:hidden cursor-pointer active:scale-95 transition-transform"
                                title="Profile & Settings"
                            >
                                <Avatar
                                    src={user?.profilePicture}
                                    name={user?.name}
                                    size={34}
                                    isOnline={true}
                                />
                            </div>
                        )}
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            {isGroupsView ? "Groups" : "Messages"}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                                {isGroupsView
                                    ? conversations.filter((c) => c.isGroup).length
                                    : conversations.length}
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Mobile PWA Install Button (When not installed) */}
                        {!isInstalled && (
                            <button
                                type="button"
                                onClick={canPromptDirectly ? triggerInstall : openInstallModal}
                                className="md:hidden w-8 h-8 rounded-xl bg-purple-600/20 text-purple-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-purple-500/30 shadow-xs"
                                title="Install App"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        )}

                        {/* Mobile Theme Toggle Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (themeMode === THEME_MODES.SYSTEM) changeThemeMode(THEME_MODES.DARK);
                                else if (themeMode === THEME_MODES.DARK) changeThemeMode(THEME_MODES.LIGHT);
                                else changeThemeMode(THEME_MODES.SYSTEM);
                            }}
                            className="md:hidden w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
                            title={`Theme: ${themeMode} (${resolvedTheme})`}
                        >
                            {resolvedTheme === "light" ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            )}
                        </button>

                        {isGroupsView && onOpenCreateGroup && (
                            <button
                                type="button"
                                onClick={onOpenCreateGroup}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/25 hover:border-purple-500/40 text-purple-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                title="Create New Group"
                            >
                                <span className="text-sm">👥</span>
                                <span className="hidden sm:inline">New Group</span>
                            </button>
                        )}
                        {onOpenSettings && (
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="md:hidden w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                title="Settings"
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
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                        placeholder={
                            isGroupsView
                                ? "Search groups..."
                                : "Search name or 10-digit phone..."
                        }
                        className="w-full pl-9 pr-8 py-2.5 md:py-2 text-sm md:text-xs rounded-xl bg-[#16162a] border border-white/5 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:bg-[#1a1a32] transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setDbUsers([]);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs w-4 h-4 rounded-full flex items-center justify-center"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Filter Pills (only when not actively searching) */}
                {!searchQuery && (
                    <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setFilterType("all")}
                            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                filterType === "all"
                                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            {isGroupsView ? "All Groups" : "All"}
                        </button>

                        {!isGroupsView && (
                            <button
                                onClick={() => setFilterType("direct")}
                                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                    filterType === "direct"
                                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Direct
                            </button>
                        )}

                        {!isGroupsView && (
                            <button
                                onClick={() => setFilterType("groups")}
                                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                    filterType === "groups"
                                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                Groups
                            </button>
                        )}

                        <button
                            onClick={() => setFilterType("unread")}
                            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                filterType === "unread"
                                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            Unread
                        </button>
                    </div>
                )}
            </div>

            {/* Conversation / Search Results List */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0 divide-y divide-white/[0.03]">
                {loading ? (
                    <div className="p-6 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        Loading conversations...
                    </div>
                ) : (
                    <>
                        {/* ========================================================
                            SECTION 1: EXISTING CHATS (Pehle message hua hai)
                            ======================================================== */}
                        {searchQuery && existingMatches.length > 0 && (
                            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                <span>Previous Chats ({existingMatches.length})</span>
                                <span className="text-[10px] text-purple-400 font-normal normal-case">
                                    Already chatted
                                </span>
                            </div>
                        )}

                        {displayedConversations.map((conv) => {
                            const partner = conv.user;
                            if (!partner) return null;

                            const isSelected = selectedConversation?._id === conv._id;
                            const isTyping = typingUsers[conv._id];
                            const lastMsg = conv.lastMessage;
                            const isMyMessage = lastMsg?.sender === user?._id;

                            return (
                                <div
                                    key={conv._id}
                                    onClick={() => handleItemClick(conv)}
                                    className={`group relative flex items-center gap-3.5 px-4 py-3 cursor-pointer transition-all border-l-3 ${
                                        isSelected
                                            ? "selected-chat-item bg-[#181830] border-purple-500 shadow-inner"
                                            : conv.isPinned
                                            ? "bg-purple-950/15 border-purple-500/40 hover:bg-purple-950/25"
                                            : "border-transparent hover:bg-white/[0.03]"
                                    }`}
                                >
                                    {conv.isGroup ? (
                                        <div className="w-[46px] h-[46px] rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md ring-2 ring-purple-500/20 shrink-0 overflow-hidden">
                                            {conv.groupAvatar ? (
                                                conv.groupAvatar.startsWith("http") ||
                                                conv.groupAvatar.startsWith("data:") ? (
                                                    <img
                                                        src={conv.groupAvatar}
                                                        alt={partner.name || "Group"}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-xl leading-none">{conv.groupAvatar}</span>
                                                )
                                            ) : (
                                                <span className="text-sm">👥</span>
                                            )}
                                        </div>
                                    ) : (
                                        <Avatar
                                            src={partner.profilePicture}
                                            name={partner.name}
                                            isOnline={partner.isOnline}
                                            size={46}
                                        />
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5 truncate">
                                                {conv.isPinned && (
                                                    <span className="text-purple-400 shrink-0" title="Pinned Chat">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                                            <path d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z" />
                                                        </svg>
                                                    </span>
                                                )}
                                                <h3
                                                    className={`text-sm truncate font-medium ${
                                                        isSelected
                                                            ? "text-white font-semibold"
                                                            : "text-zinc-200"
                                                    }`}
                                                >
                                                    {partner.name}
                                                </h3>
                                                {conv.isGroup && (
                                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0 ${
                                                        conv.isLeft || conv.user?.isLeft
                                                            ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
                                                            : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                                    }`}>
                                                        {conv.isLeft || conv.user?.isLeft ? "Left" : "Group"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                {lastMsg && (
                                                    <span className="text-[11px] text-zinc-400">
                                                        {formatChatTime(lastMsg.createdAt)}
                                                    </span>
                                                )}
                                                {/* Pin / Unpin button */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePinConversation(conv._id);
                                                    }}
                                                    title={conv.isPinned ? "Unpin chat" : "Pin chat to top"}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                                        conv.isPinned
                                                            ? "text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                                                            : "text-zinc-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100"
                                                    }`}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="w-3.5 h-3.5"
                                                        viewBox="0 0 24 24"
                                                        fill={conv.isPinned ? "currentColor" : "none"}
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 12V4h1V2H7v2h1v8l-2 3v2h5.2v5l.8.8.8-.8v-5H18v-2l-2-3z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            {isTyping ? (
                                                <div className="text-purple-400 flex items-center gap-1.5 font-medium animate-pulse">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
                                                    <span>typing...</span>
                                                </div>
                                            ) : (
                                                <p className="text-zinc-400 truncate flex items-center gap-1 text-[12px]">
                                                    {isMyMessage && (
                                                        <span
                                                            className={`font-mono text-xs ${
                                                                lastMsg?.isSeen
                                                                    ? "text-blue-400 font-bold"
                                                                    : "text-zinc-400"
                                                            }`}
                                                        >
                                                            {lastMsg?.isSeen
                                                                ? "✓✓"
                                                                : lastMsg?.isDelivered
                                                                ? "✓✓"
                                                                : "✓"}
                                                        </span>
                                                    )}
                                                    <span>
                                                        {lastMsg?.isDeleted || lastMsg?.deletedForEveryone
                                                            ? "🚫 This message was deleted"
                                                            : lastMsg?.messageType === "system"
                                                            ? lastMsg.text
                                                            : lastMsg?.messageType === "call"
                                                            ? `${lastMsg.callDetails?.callType === "video" || lastMsg.text?.includes("Video") || lastMsg.text?.includes("video") ? "📹" : "📞"} ${lastMsg.text || "Call"}`
                                                            : lastMsg?.text
                                                            ? lastMsg.text.startsWith("enc:v1:")
                                                                ? "🔒 Encrypted Message"
                                                                : lastMsg.text
                                                            : lastMsg?.messageType === "audio"
                                                            ? "🎤 Voice message"
                                                            : lastMsg?.messageType === "image"
                                                            ? "📷 Photo"
                                                            : lastMsg?.messageType === "file"
                                                            ? `📄 ${lastMsg.fileName || "Document"}`
                                                            : partner.phone
                                                            ? `Phone: ${partner.phone}`
                                                            : "Start a conversation"}
                                                    </span>
                                                </p>
                                            )}

                                            {lastMsg && !lastMsg.isSeen && !isMyMessage && (
                                                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 shadow-sm shadow-purple-500/50" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* ========================================================
                            SECTION 2: REGISTERED USERS IN DB (Direct Chat Karo)
                            ======================================================== */}
                        {searchQuery && dbUsers.length > 0 && (
                            <div className="px-4 py-2 bg-purple-950/20 border-t border-b border-purple-500/10 flex items-center justify-between text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
                                <span>Users on ChatApp ({dbUsers.length})</span>
                                <span className="text-[10px] text-emerald-400 font-normal normal-case flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Registered
                                </span>
                            </div>
                        )}

                        {searchQuery &&
                            dbUsers.map((regUser) => {
                                const isStarting = startingChatId === regUser._id;
                                return (
                                    <div
                                        key={regUser._id}
                                        onClick={() => handleStartDirectChat(regUser)}
                                        className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-purple-900/10 transition-all border-l-3 border-transparent hover:border-purple-400 group"
                                    >
                                        <Avatar
                                            src={regUser.profilePicture}
                                            name={regUser.name}
                                            isOnline={regUser.isOnline}
                                            size={46}
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h3 className="text-sm font-semibold text-white truncate">
                                                    {regUser.name}
                                                </h3>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartDirectChat(regUser);
                                                    }}
                                                    disabled={isStarting}
                                                    className="px-2.5 py-1 rounded-lg bg-purple-600 group-hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1 shrink-0"
                                                >
                                                    {isStarting ? (
                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                                            />
                                                        </svg>
                                                    )}
                                                    Direct Chat
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-400 font-mono">
                                                {regUser.phone}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}

                        {/* Database searching indicator */}
                        {searchQuery && searchingDb && (
                            <div className="p-3 text-center text-xs text-purple-400 flex items-center justify-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                <span>Searching ChatApp database...</span>
                            </div>
                        )}

                        {/* ========================================================
                            SECTION 3: NOT REGISTERED (Invite ka option aaye)
                            ======================================================== */}
                        {showInviteCard && (
                            <div className="p-4 mx-3 my-3 rounded-2xl bg-[#141426] border border-amber-500/20 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
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
                                                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                                            />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-white font-mono">
                                            +91 {cleanPhone}
                                        </p>
                                        <p className="text-[11px] text-amber-400/90 mt-0.5">
                                            Not registered on ChatApp yet
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                    <span className="text-[11px] text-zinc-400">
                                        Invite them to start chatting
                                    </span>
                                    <button
                                        onClick={handleOpenInvite}
                                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
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
                                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                            />
                                        </svg>
                                        Invite
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Empty search results fallback */}
                        {searchQuery &&
                            !searchingDb &&
                            existingMatches.length === 0 &&
                            dbUsers.length === 0 &&
                            !showInviteCard && (
                                <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-6 h-6"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">
                                            No users found for "{searchQuery}"
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                                            Type a 10-digit phone number to check registration or send an invite!
                                        </p>
                                    </div>
                                </div>
                            )}

                        {/* Default empty list when no conversations yet */}
                        {!searchQuery && displayedConversations.length === 0 && (
                            isGroupsView ? (
                                <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 rounded-3xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-2xl text-purple-400">
                                        👥
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            No groups joined yet
                                        </p>
                                        <p className="text-xs text-zinc-400 mt-1 max-w-[240px]">
                                            Create a new group to chat, share media, and collaborate with your team and friends!
                                        </p>
                                    </div>
                                    {onOpenCreateGroup && (
                                        <button
                                            type="button"
                                            onClick={onOpenCreateGroup}
                                            className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                                        >
                                            + Create New Group
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="w-6 h-6"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1.5}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">
                                            No chats yet
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                                            Search any phone number above to start a direct chat or invite a friend!
                                        </p>
                                    </div>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>

            {/* Invite Modal */}
            <InviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                phone={invitePhone}
            />
        </div>
    );
};

export default ChatList;
