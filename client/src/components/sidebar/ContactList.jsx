import React, { useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import Avatar from "../common/Avatar";
import InviteModal from "../common/InviteModal";

export const ContactList = ({ onStartChat, onOpenSettings }) => {
    const { user } = useContext(AuthContext);
    const {
        contacts,
        contactsLoading,
        conversations,
        openConversation,
        selectConversation,
        searchUsers,
    } = useContext(ChatContext);

    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef(null);

    // Database search states
    const [dbUsers, setDbUsers] = useState([]);
    const [searchingDb, setSearchingDb] = useState(false);
    const [startingChatId, setStartingChatId] = useState(null);

    // Invite modal state
    const [invitePhone, setInvitePhone] = useState("");
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const cleanPhone = searchQuery.replace(/\D/g, "");
    const cleanDigits = cleanPhone;

    // 1. Existing conversation / contact matches
    const existingMatches = conversations.filter((conv) => {
        if (!normalizedQuery) return false;
        const partner = conv.user;
        if (!partner) return false;

        const nameMatch = partner.name?.toLowerCase().includes(normalizedQuery);
        const phoneMatch = partner.phone?.includes(cleanDigits || normalizedQuery);

        return nameMatch || phoneMatch;
    });

    const filteredContacts = contacts.filter((contact) => {
        if (!normalizedQuery) return true;
        return (
            contact.name?.toLowerCase().includes(normalizedQuery) ||
            contact.phone?.includes(cleanDigits || normalizedQuery)
        );
    });

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

                // Exclude users already present in conversations or contacts
                const existingUserIds = new Set([
                    ...conversations.map((c) => c.user?._id?.toString()).filter(Boolean),
                    ...contacts.map((c) => c.user?._id?.toString()).filter(Boolean),
                ]);

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
    }, [searchQuery, conversations, contacts, searchUsers]);

    // Check if phone search has matches
    const isPhoneQuery = cleanDigits.length >= 7;
    const hasExistingPhoneMatch =
        existingMatches.some((c) => {
            const pPhone = c.user?.phone?.replace(/\D/g, "") || "";
            return pPhone.includes(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.includes(pPhone));
        }) ||
        filteredContacts.some((c) => {
            const pPhone = c.phone?.replace(/\D/g, "") || "";
            return pPhone.includes(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.includes(pPhone));
        });

    const hasDbPhoneMatch = dbUsers.some((u) => {
        const uPhone = u.phone?.replace(/\D/g, "") || "";
        return uPhone.includes(cleanDigits) || (cleanDigits.length >= 10 && cleanDigits.includes(uPhone));
    });

    const showInviteCard =
        isPhoneQuery && !hasExistingPhoneMatch && !hasDbPhoneMatch && !searchingDb;

    const handleStartDirectChat = async (targetUserId) => {
        if (!targetUserId) return;
        try {
            setStartingChatId(targetUserId);
            const conversation = await openConversation(targetUserId);
            if (conversation) {
                await selectConversation(conversation);
                onStartChat?.(conversation);
                setSearchQuery("");
            }
        } catch (error) {
            console.error("Open chat error:", error);
        } finally {
            setStartingChatId(null);
        }
    };

    const handleFocusSearch = () => {
        searchInputRef.current?.focus();
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f0f1c] select-none h-full border-r border-white/5">
            {/* Header */}
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 border-b border-white/5 space-y-3">
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
                            Contacts
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                                {contacts.length}
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleFocusSearch}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
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
                                    strokeWidth={2.5}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            <span>Find User</span>
                        </button>
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
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name or 10-digit phone..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#16162a] border border-white/5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:bg-[#1a1a32] transition-all"
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
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0 divide-y divide-white/[0.03]">
                {contactsLoading ? (
                    <div className="p-6 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        Loading contacts...
                    </div>
                ) : (
                    <>
                        {/* 1. Existing Chats match */}
                        {searchQuery && existingMatches.length > 0 && (
                            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                <span>Previous Chats ({existingMatches.length})</span>
                                <span className="text-[10px] text-purple-400 font-normal normal-case">
                                    Already chatted
                                </span>
                            </div>
                        )}

                        {searchQuery &&
                            existingMatches.map((conv) => {
                                const partner = conv.user;
                                if (!partner) return null;
                                return (
                                    <div
                                        key={conv._id}
                                        onClick={() => handleStartDirectChat(partner._id)}
                                        className="flex items-center gap-3.5 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-all"
                                    >
                                        <Avatar
                                            src={partner.profilePicture}
                                            name={partner.name}
                                            size={44}
                                            isOnline={partner.isOnline}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-white truncate">
                                                    {partner.name}
                                                </h3>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                                                    Chat
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                                {partner.phone}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}

                        {/* 2. Registered Users in DB */}
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
                                        onClick={() => handleStartDirectChat(regUser._id)}
                                        className="flex items-center gap-3.5 px-4 py-3 hover:bg-purple-900/10 cursor-pointer transition-all border-l-3 border-transparent hover:border-purple-400 group"
                                    >
                                        <Avatar
                                            src={regUser.profilePicture}
                                            name={regUser.name}
                                            size={44}
                                            isOnline={regUser.isOnline}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-white truncate">
                                                    {regUser.name}
                                                </h3>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartDirectChat(regUser._id);
                                                    }}
                                                    disabled={isStarting}
                                                    className="px-2.5 py-1 rounded-lg bg-purple-600 group-hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                                                >
                                                    {isStarting ? (
                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        "Direct Chat"
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-400 font-mono mt-0.5">
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
                                <span>Checking ChatApp database...</span>
                            </div>
                        )}

                        {/* 3. Not Registered - Invite Option */}
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
                                        Send them an invitation
                                    </span>
                                    <button
                                        onClick={() => {
                                            setInvitePhone(cleanDigits);
                                            setIsInviteModalOpen(true);
                                        }}
                                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
                                    >
                                        Invite
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Standard saved contacts (when not searching or matching) */}
                        {!searchQuery && (
                            filteredContacts.length === 0 ? (
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
                                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-300">
                                            No saved contacts
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1 max-w-[200px]">
                                            Type any phone number in the search bar above to start direct chatting!
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                filteredContacts.map((contact) => (
                                    <div
                                        key={contact._id}
                                        onClick={() => {
                                            const userId = contact.user?._id || contact.user;
                                            if (userId) handleStartDirectChat(userId);
                                            else {
                                                setInvitePhone(contact.phone);
                                                setIsInviteModalOpen(true);
                                            }
                                        }}
                                        className="flex items-center gap-3.5 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-all"
                                    >
                                        <Avatar
                                            src={contact.user?.profilePicture}
                                            name={contact.name}
                                            size={44}
                                            isOnline={contact.user?.isOnline}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium text-zinc-200 truncate">
                                                    {contact.name}
                                                </h3>
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                        contact.registered
                                                            ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                    }`}
                                                >
                                                    {contact.registered ? "Chat" : "Invite"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400 font-mono mt-0.5">
                                                {contact.phone}
                                            </p>
                                        </div>
                                    </div>
                                ))
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

export default ContactList;
