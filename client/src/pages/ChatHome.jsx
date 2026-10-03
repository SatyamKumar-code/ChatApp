import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

// Modular Components
import NavigationRail from "../components/sidebar/NavigationRail";
import ChatList from "../components/sidebar/ChatList";
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

export const ChatHome = () => {
    const { user } = useContext(AuthContext);
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
    const [forwardingMessage, setForwardingMessage] = useState(null);

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
        <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a14] text-zinc-100 font-sans antialiased">
            {/* 1. Left Icon Navigation Rail */}
            <NavigationRail
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenSettings={() => setIsSettingsOpen(true)}
                unreadTotal={totalUnread}
            />

            {/* 2. Conversations / Contacts Sidebar */}
            <div
                className={`w-full md:w-80 lg:w-96 shrink-0 h-full flex flex-col ${selectedConversation ? "hidden md:flex" : "flex"
                    }`}
            >
                {activeTab === "chats" ? (
                    <ChatList
                        onSelectChat={() => setIsProfilePanelOpen(false)}
                        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
                    />
                ) : (
                    <ContactList
                        onStartChat={() => setActiveTab("chats")}
                    />
                )}
            </div>

            {/* 3. Main Chat View */}
            <div
                className={`flex-1 flex flex-col h-full min-w-0 bg-[#0c0c1a] relative ${!selectedConversation ? "hidden md:flex" : "flex"
                    }`}
            >
                {selectedConversation ? (
                    <>
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

                        {/* Message Input Box */}
                        <MessageInput
                            onSendMessage={handleSendMessage}
                            onTyping={startTyping}
                            onStopTyping={stopTyping}
                            disabled={isSending}
                        />
                    </>
                ) : (
                    <EmptyChat onOpenContacts={() => setActiveTab("contacts")} />
                )}
            </div>

            {/* 4. Right Contact Detail Drawer (Desktop) */}
            {selectedConversation && isProfilePanelOpen && (
                <ProfilePanel
                    partner={selectedConversation.user}
                    conversation={selectedConversation}
                    onClose={() => setIsProfilePanelOpen(false)}
                    onOpenVerifyEncryption={() => setIsVerifyEncryptionOpen(true)}
                />
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
        </div>
    );
};

export default ChatHome;