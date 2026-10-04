import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import api from "../services/api";
import { AuthContext } from "./AuthContext";
import socket from "../services/socket";
import { playMessageSound } from "../utils/callSounds";
import { encryptMessage, decryptMessage } from "../utils/e2ee";

export const ChatContext = createContext();


const ChatProvider = ({ children }) => {
    const { user } = useContext(AuthContext);

    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [contacts, setContacts] = useState([]);
    const [contactsLoading, setContactsLoading] = useState(false);

    const [messages, setMessages] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);

    // Multi-select messages state
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);

    const toggleSelectMessage = (messageId) => {
        if (!messageId) return;
        setSelectedMessageIds((prev) =>
            prev.includes(messageId)
                ? prev.filter((id) => id !== messageId)
                : [...prev, messageId]
        );
    };

    const clearSelectedMessages = () => {
        setSelectedMessageIds([]);
    };

    const selectAllMessages = () => {
        const selectable = messages
            .filter((m) => m.messageType !== "system" && !m.isDeleted && !m.deletedForEveryone)
            .map((m) => m._id);
        setSelectedMessageIds(selectable);
    };

    const deleteSelectedMessages = async (deleteType = "forMe") => {
        if (selectedMessageIds.length === 0) return;
        const ids = [...selectedMessageIds];
        clearSelectedMessages();
        for (const id of ids) {
            await deleteMessage(id, deleteType);
        }
    };

    const starSelectedMessages = async () => {
        if (selectedMessageIds.length === 0) return;
        const ids = [...selectedMessageIds];
        for (const id of ids) {
            await toggleStarMessage(id);
        }
        clearSelectedMessages();
    };

    const copySelectedMessages = () => {
        if (selectedMessageIds.length === 0) return "";
        const selectedMsgs = messages.filter((m) => selectedMessageIds.includes(m._id));
        const textToCopy = selectedMsgs
            .map((m) => m.text || (m.fileName ? `[File: ${m.fileName}]` : ""))
            .filter(Boolean)
            .join("\n");
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
        }
        return textToCopy;
    };

    // Blocked users state
    const [blockedUsers, setBlockedUsers] = useState([]);
    const blockedUsersRef = useRef([]);

    useEffect(() => {
        blockedUsersRef.current = blockedUsers;
    }, [blockedUsers]);

    // Typing indicator state
    const [typingUsers, setTypingUsers] = useState({}); // { conversationId: { userId, userName } }
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Keep a ref to selectedConversation for use inside socket handlers
    const selectedConversationRef = useRef(null);

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        if (!user) {
            if (socket.connected) {
                socket.disconnect();
            }

            return;
        }

        socket.connect();

        const handleConnect = () => {
            console.log(
                "Socket connected:",
                socket.id
            );
        };

        const handleSocketConnected = (data) => {
            console.log(
                "Socket authenticated:",
                data
            );
        };

        const handleConnectError = (error) => {
            console.error(
                "Socket connection error:",
                error.message
            );
        };

        const handleDisconnect = (reason) => {
            console.log(
                "Socket disconnected:",
                reason
            );
        };

        const handleNewMessage = async (message) => {
            console.log(
                "New message received:",
                message
            );

            // If message is from a blocked user, drop it immediately
            const senderId = (message.sender?._id || message.sender)?.toString();
            if (
                senderId &&
                blockedUsersRef.current.some(
                    (b) => (b?._id || b)?.toString() === senderId
                )
            ) {
                console.log("Dropping message from blocked user:", senderId);
                return;
            }

            const convId = message.conversation?._id || message.conversation;
            let decryptedMessage = message;
            if (message.text && convId) {
                const decryptedText = await decryptMessage(message.text, convId);
                decryptedMessage = { ...message, text: decryptedText };
            }

            setMessages((prev) => {
                // Prevent duplicate message
                const alreadyExists = prev.some(
                    (item) =>
                        item._id === decryptedMessage._id
                );

                if (alreadyExists) {
                    return prev;
                }

                return [...prev, decryptedMessage];
            });

            // If the message is for the currently open conversation and I am the receiver,
            // immediately mark it as seen
            const currentConv = selectedConversationRef.current;
            if (
                currentConv &&
                message.conversation === currentConv._id &&
                message.receiver?._id === user._id
            ) {
                socket.emit("message:markSeen", {
                    conversationId: currentConv._id,
                });
            }

            // Refresh chat list
            getConversations();

            // Play sound chime if message was sent by someone else
            if (message.sender?._id !== user?._id && message.sender !== user?._id) {
                playMessageSound();
            }
        };

        // ==============================
        // DELIVERED STATUS HANDLER
        // ==============================
        const handleMessageDelivered = (data) => {
            const { messages: deliveredMsgs } = data;

            if (!deliveredMsgs || deliveredMsgs.length === 0) return;

            setMessages((prev) =>
                prev.map((msg) => {
                    const delivered = deliveredMsgs.find(
                        (d) => d.messageId === msg._id
                    );
                    if (delivered) {
                        return { ...msg, isDelivered: true };
                    }
                    return msg;
                })
            );

            // Update conversation list to reflect delivered status
            getConversations();
        };

        // ==============================
        // SEEN STATUS HANDLER
        // ==============================
        const handleMessageSeen = (data) => {
            const {
                conversationId,
                messages: seenMsgs,
                seenAt,
            } = data;

            if (!seenMsgs || seenMsgs.length === 0) return;

            setMessages((prev) =>
                prev.map((msg) => {
                    const seen = seenMsgs.find(
                        (s) => s.messageId === msg._id
                    );
                    if (seen) {
                        return {
                            ...msg,
                            isSeen: true,
                            isDelivered: true,
                            seenAt,
                        };
                    }
                    return msg;
                })
            );

            // Update conversation list
            getConversations();
        };

        // ==============================
        // TYPING INDICATOR HANDLERS
        // ==============================
        const handleTypingStart = (data) => {
            const { conversationId, userId: typingUserId, userName } = data;

            setTypingUsers((prev) => ({
                ...prev,
                [conversationId]: {
                    userId: typingUserId,
                    userName,
                },
            }));
        };

        const handleTypingStop = (data) => {
            const { conversationId } = data;

            setTypingUsers((prev) => {
                const updated = { ...prev };
                delete updated[conversationId];
                return updated;
            });
        };

        // ==============================
        // ONLINE / OFFLINE HANDLERS
        // ==============================
        const handleUserOnline = (data) => {
            const { userId: onlineUserId } = data;

            // Update conversations list to reflect online status (unless blocked)
            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.user?._id === onlineUserId) {
                        if (conv.isBlockedByOther || conv.user?.isBlockedByOther) {
                            return conv;
                        }
                        return {
                            ...conv,
                            user: { ...conv.user, isOnline: true },
                        };
                    }
                    return conv;
                })
            );

            setSelectedConversation((prev) => {
                if (prev && prev.user?._id === onlineUserId) {
                    if (prev.isBlockedByOther || prev.user?.isBlockedByOther) {
                        return prev;
                    }
                    return {
                        ...prev,
                        user: { ...prev.user, isOnline: true },
                    };
                }
                return prev;
            });

            setContacts((prev) =>
                prev.map((c) => {
                    if (c.user?._id === onlineUserId) {
                        if (c.user?.isBlockedByOther) {
                            return c;
                        }
                        return {
                            ...c,
                            user: { ...c.user, isOnline: true },
                        };
                    }
                    return c;
                })
            );
        };

        const handleUserOffline = (data) => {
            const { userId: offlineUserId, lastSeen } = data;

            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.user?._id === offlineUserId) {
                        if (conv.isBlockedByOther || conv.user?.isBlockedByOther) {
                            return conv;
                        }
                        return {
                            ...conv,
                            user: {
                                ...conv.user,
                                isOnline: false,
                                lastSeen,
                            },
                        };
                    }
                    return conv;
                })
            );

            setSelectedConversation((prev) => {
                if (prev && prev.user?._id === offlineUserId) {
                    if (prev.isBlockedByOther || prev.user?.isBlockedByOther) {
                        return prev;
                    }
                    return {
                        ...prev,
                        user: {
                            ...prev.user,
                            isOnline: false,
                            lastSeen,
                        },
                    };
                }
                return prev;
            });

            setContacts((prev) =>
                prev.map((c) => {
                    if (c.user?._id === offlineUserId) {
                        if (c.user?.isBlockedByOther) {
                            return c;
                        }
                        return {
                            ...c,
                            user: {
                                ...c.user,
                                isOnline: false,
                                lastSeen,
                            },
                        };
                    }
                    return c;
                })
            );
        };

        // ==============================
        // REACTION & DELETE HANDLERS
        // ==============================
        const handleReactionUpdated = (data) => {
            const { messageId, reactions } = data;
            setMessages((prev) =>
                prev.map((msg) =>
                    msg._id === messageId ? { ...msg, reactions } : msg
                )
            );
        };

        const handleMessageDeleted = (data) => {
            const { messageId, deleteType } = data;
            if (deleteType === "forEveryone") {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg._id === messageId
                            ? {
                                  ...msg,
                                  isDeleted: true,
                                  deletedForEveryone: true,
                                  text: "This message was deleted",
                                  fileUrl: "",
                                  fileName: "",
                                  fileSize: 0,
                                  duration: 0,
                                  reactions: [],
                              }
                            : msg
                    )
                );
            } else {
                setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
            }
        };

        const handlePinnedMessagesUpdated = async (data) => {
            const { conversationId, pinnedMessages } = data;
            const decryptedPinned = await Promise.all(
                (pinnedMessages || []).map(async (msg) => {
                    if (msg.text) {
                        const decryptedText = await decryptMessage(msg.text, conversationId);
                        return { ...msg, text: decryptedText };
                    }
                    return msg;
                })
            );

            setSelectedConversation((prev) => {
                if (!prev || prev._id !== conversationId) return prev;
                return { ...prev, pinnedMessages: decryptedPinned };
            });

            setConversations((prev) =>
                prev.map((c) =>
                    c._id === conversationId
                        ? { ...c, pinnedMessages: decryptedPinned }
                        : c
                )
            );
        };

        const handleGroupUpdated = (updatedGroup) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === updatedGroup._id ? { ...c, ...updatedGroup } : c
                )
            );
            setSelectedConversation((prev) => {
                if (!prev || prev._id !== updatedGroup._id) return prev;
                return { ...prev, ...updatedGroup };
            });
        };

        const handleGroupCreated = (newGroup) => {
            setConversations((prev) => {
                if (prev.some((c) => c._id === newGroup._id)) return prev;
                return [newGroup, ...prev];
            });
        };

        const handleGroupRemoved = ({ conversationId }) => {
            setConversations((prev) => prev.filter((c) => c._id !== conversationId));
            setSelectedConversation((prev) => {
                if (!prev || prev._id !== conversationId) return prev;
                return null;
            });
        };

        socket.on("connect", handleConnect);
        socket.on("socket:connected", handleSocketConnected);
        socket.on("connect_error", handleConnectError);
        socket.on("disconnect", handleDisconnect);
        socket.on("newMessage", handleNewMessage);
        socket.on("message:delivered", handleMessageDelivered);
        socket.on("message:seen", handleMessageSeen);
        socket.on("message:reactionUpdated", handleReactionUpdated);
        socket.on("message:deleted", handleMessageDeleted);
        socket.on("typing:start", handleTypingStart);
        socket.on("typing:stop", handleTypingStop);
        socket.on("user:online", handleUserOnline);
        socket.on("user:offline", handleUserOffline);
        socket.on("conversation:pinnedMessagesUpdated", handlePinnedMessagesUpdated);
        socket.on("group:updated", handleGroupUpdated);
        socket.on("group:created", handleGroupCreated);
        socket.on("group:removed", handleGroupRemoved);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("socket:connected", handleSocketConnected);
            socket.off("connect_error", handleConnectError);
            socket.off("disconnect", handleDisconnect);
            socket.off("newMessage", handleNewMessage);
            socket.off("message:delivered", handleMessageDelivered);
            socket.off("message:seen", handleMessageSeen);
            socket.off("message:reactionUpdated", handleReactionUpdated);
            socket.off("message:deleted", handleMessageDeleted);
            socket.off("typing:start", handleTypingStart);
            socket.off("typing:stop", handleTypingStop);
            socket.off("user:online", handleUserOnline);
            socket.off("user:offline", handleUserOffline);
            socket.off("conversation:pinnedMessagesUpdated", handlePinnedMessagesUpdated);
            socket.off("group:updated", handleGroupUpdated);
            socket.off("group:created", handleGroupCreated);
            socket.off("group:removed", handleGroupRemoved);

            socket.disconnect();
        };
    }, [user]);

    const addContact = async (phone, name) => {
        try {
            const body = { phone };
            if (name?.trim()) {
                body.name = name.trim();
            }

            const response = await api.post("/contacts", body);

            if (response.data.success) {
                await getContacts();

                return response.data;
            }
        } catch (error) {
            console.error(
                "Add contact error:",
                error
            );

            throw error;
        }
    };

    const getContacts = async () => {
        try {
            setContactsLoading(true);

            const response = await api.get("/contacts");

            if (response.data.success) {
                setContacts(response.data.contacts);
            }
        } catch (error) {
            console.error(
                "Get contacts error:",
                error
            );

            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const getConversations = async () => {
        try {
            setLoading(true);

            const response = await api.get("/conversations");

            if (response.data.success) {
                const convs = response.data.conversations || [];
                const decryptedConvs = await Promise.all(
                    convs.map(async (conv) => {
                        if (conv.lastMessage?.text) {
                            const decryptedText = await decryptMessage(conv.lastMessage.text, conv._id);
                            return {
                                ...conv,
                                lastMessage: { ...conv.lastMessage, text: decryptedText },
                            };
                        }
                        return conv;
                    })
                );
                setConversations(decryptedConvs);
            }
        } catch (error) {
            console.error(
                "Get conversations error:",
                error
            );

            setConversations([]);
        } finally {
            setLoading(false);
        }
    };


    const openConversation = async (userId) => {
        try {
            const response = await api.post(
                "/conversations",
                {
                    userId,
                }
            );

            if (response.data.success) {
                await getConversations();

                return response.data.conversation;
            }
        } catch (error) {
            console.error(
                "Open conversation error:",
                error
            );

            throw error;
        }
    };

    const searchUsers = async (query) => {
        if (!query || !query.trim()) return [];
        try {
            const response = await api.get("/auth/search", {
                params: { query: query.trim() },
            });
            if (response.data.success) {
                return response.data.users || [];
            }
            return [];
        } catch (error) {
            console.error("Search users error:", error);
            return [];
        }
    };

    const getMessages = async (conversationId) => {
        try {
            setMessagesLoading(true);

            const response = await api.get(
                `/messages/${conversationId}`
            );

            if (response.data.success) {
                const rawMsgs = response.data.messages || [];
                const decryptedMsgs = await Promise.all(
                    rawMsgs.map(async (msg) => {
                        if (msg.text) {
                            const decryptedText = await decryptMessage(msg.text, conversationId);
                            return { ...msg, text: decryptedText };
                        }
                        return msg;
                    })
                );
                setMessages(decryptedMsgs);
            }
        } catch (error) {
            console.error(
                "Get messages error:",
                error
            );

            setMessages([]);
        } finally {
            setMessagesLoading(false);
        }
    };

    const sendMessage = async (payload) => {
        if (!selectedConversation) return;

        // Support string (for backward compatibility) or object { text, fileUrl, fileName, fileSize, messageType, replyTo }
        const data = typeof payload === "string" ? { text: payload } : payload || {};
        const text = data.text ? data.text.trim() : "";
        const fileUrl = data.fileUrl || "";

        if (!text && !fileUrl) return;

        if (!socket.connected) {
            throw new Error("Socket is not connected");
        }

        // Stop typing when sending
        stopTyping();

        const replyToId = data.replyTo || replyingTo?._id || null;

        // End-to-End Encrypt text with conversation AES-GCM key before transmission
        const encryptedText = text
            ? await encryptMessage(text, selectedConversation._id)
            : "";

        socket.emit("sendMessage", {
            conversationId: selectedConversation._id,
            text: encryptedText,
            fileUrl,
            fileName: data.fileName || "",
            fileSize: data.fileSize || 0,
            duration: data.duration || 0,
            messageType: data.messageType || (fileUrl ? (fileUrl.startsWith("data:audio") ? "audio" : fileUrl.startsWith("data:image") ? "image" : "file") : "text"),
            replyTo: replyToId,
        });

        setReplyingTo(null);
    };

    const reactToMessage = async (messageId, emoji) => {
        if (!messageId || !emoji || !user) return;

        // Optimistic UI update
        setMessages((prev) =>
            prev.map((msg) => {
                if (msg._id !== messageId) return msg;
                const existingReactions = msg.reactions ? [...msg.reactions] : [];
                const myIndex = existingReactions.findIndex(
                    (r) => (r.user?._id || r.user) === user._id
                );

                if (myIndex > -1) {
                    if (existingReactions[myIndex].emoji === emoji) {
                        existingReactions.splice(myIndex, 1);
                    } else {
                        existingReactions[myIndex] = {
                            ...existingReactions[myIndex],
                            emoji,
                        };
                    }
                } else {
                    existingReactions.push({
                        user: {
                            _id: user._id,
                            name: user.name,
                            profilePicture: user.profilePicture,
                        },
                        emoji,
                    });
                }
                return { ...msg, reactions: existingReactions };
            })
        );

        if (socket.connected) {
            socket.emit("message:react", {
                messageId,
                emoji,
                conversationId: selectedConversation?._id,
            });
        }

        try {
            await api.post(`/messages/${messageId}/react`, { emoji });
        } catch (err) {
            console.error("Failed to react to message:", err);
        }
    };

    const deleteMessage = async (messageId, deleteType = "forEveryone") => {
        if (!messageId) return;

        // Optimistic UI update
        if (deleteType === "forEveryone") {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg._id === messageId
                        ? {
                              ...msg,
                              isDeleted: true,
                              deletedForEveryone: true,
                              text: "This message was deleted",
                              fileUrl: "",
                              fileName: "",
                              fileSize: 0,
                              duration: 0,
                              reactions: [],
                          }
                        : msg
                )
            );
        } else {
            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        }

        if (socket.connected) {
            socket.emit("message:delete", {
                messageId,
                deleteType,
                conversationId: selectedConversation?._id,
            });
        }

        try {
            await api.post(`/messages/${messageId}/delete`, { deleteType });
        } catch (err) {
            console.error("Failed to delete message:", err);
        }
    };

    const toggleStarMessage = async (messageId) => {
        if (!messageId || !user) return;

        // Optimistically update message in state
        setMessages((prev) =>
            prev.map((msg) => {
                if (msg._id !== messageId) return msg;
                const starredBy = Array.isArray(msg.starredBy) ? [...msg.starredBy] : [];
                const idx = starredBy.findIndex(
                    (id) => (id?._id || id)?.toString() === user._id.toString()
                );
                if (idx > -1) {
                    starredBy.splice(idx, 1);
                } else {
                    starredBy.push(user._id);
                }
                return { ...msg, starredBy };
            })
        );

        try {
            const res = await api.post(`/messages/${messageId}/star`);
            return res.data;
        } catch (err) {
            console.error("Failed to toggle star message:", err);
        }
    };

    // Toggle Pin Conversation in Sidebar
    const togglePinConversation = async (conversationId) => {
        if (!conversationId) return;

        // Optimistically toggle isPinned and sort
        setConversations((prev) => {
            const updated = prev.map((c) => {
                if (c._id === conversationId) {
                    return { ...c, isPinned: !c.isPinned };
                }
                return c;
            });

            return [...updated].sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt);
            });
        });

        setSelectedConversation((prev) => {
            if (!prev || prev._id !== conversationId) return prev;
            return { ...prev, isPinned: !prev.isPinned };
        });

        try {
            const res = await api.post(`/conversations/${conversationId}/pin`);
            return res.data;
        } catch (err) {
            console.error("Failed to toggle pin conversation:", err);
            getConversations();
        }
    };

    // Toggle Pin Message inside active conversation
    const togglePinMessage = async (messageId) => {
        const convId = selectedConversation?._id;
        if (!convId || !messageId) return;

        try {
            const res = await api.post(`/conversations/${convId}/messages/${messageId}/pin`);
            const updatedPinned = res.data?.pinnedMessages || [];

            const decryptedPinned = await Promise.all(
                updatedPinned.map(async (msg) => {
                    if (msg.text) {
                        const decryptedText = await decryptMessage(msg.text, convId);
                        return { ...msg, text: decryptedText };
                    }
                    return msg;
                })
            );

            setSelectedConversation((prev) => {
                if (!prev || prev._id !== convId) return prev;
                return { ...prev, pinnedMessages: decryptedPinned };
            });

            setConversations((prev) =>
                prev.map((c) =>
                    c._id === convId
                        ? { ...c, pinnedMessages: decryptedPinned }
                        : c
                )
            );

            return res.data;
        } catch (err) {
            console.error("Failed to toggle pin message:", err);
        }
    };

    // Forward message to one or multiple conversations
    const forwardMessage = async (message, targetConversationIds) => {
        if (!message || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
            return;
        }

        try {
            for (const convId of targetConversationIds) {
                const encryptedText = message.text
                    ? await encryptMessage(message.text, convId)
                    : "";

                socket.emit("sendMessage", {
                    conversationId: convId,
                    text: encryptedText,
                    fileUrl: message.fileUrl || "",
                    fileName: message.fileName || "",
                    fileSize: message.fileSize || 0,
                    duration: message.duration || 0,
                    messageType:
                        message.messageType ||
                        (message.fileUrl
                            ? message.fileUrl.startsWith("data:audio")
                                ? "audio"
                                : message.fileUrl.startsWith("data:image")
                                ? "image"
                                : "file"
                            : "text"),
                    isForwarded: true,
                });
            }

            await getConversations();
        } catch (err) {
            console.error("Failed to forward message:", err);
            throw err;
        }
    };

    const getStarredMessages = async (conversationId) => {
        try {
            const params = {};
            if (conversationId) params.conversationId = conversationId;
            const res = await api.get("/messages/starred/all", { params });
            const list = res.data?.starredMessages || [];
            const decryptedList = await Promise.all(
                list.map(async (msg) => {
                    const convId = msg.conversation?._id || msg.conversation;
                    if (msg.text && convId) {
                        const decryptedText = await decryptMessage(msg.text, convId);
                        return { ...msg, text: decryptedText };
                    }
                    return msg;
                })
            );
            return decryptedList;
        } catch (err) {
            console.error("Failed to fetch starred messages:", err);
            return [];
        }
    };

    const selectConversation = async (conversation) => {
        setReplyingTo(null);
        setSelectedMessageIds([]);

        if (conversation) {
            let convToSet = conversation;
            if (conversation.pinnedMessages && conversation.pinnedMessages.length > 0) {
                const decryptedPinned = await Promise.all(
                    conversation.pinnedMessages.map(async (pm) => {
                        if (pm.text) {
                            const dt = await decryptMessage(pm.text, conversation._id);
                            return { ...pm, text: dt };
                        }
                        return pm;
                    })
                );
                convToSet = { ...convToSet, pinnedMessages: decryptedPinned };
            }
            setSelectedConversation(convToSet);
            await getMessages(conversation._id);

            // Mark messages as seen when opening a conversation
            if (socket.connected) {
                socket.emit("message:markSeen", {
                    conversationId: conversation._id,
                });
            }
        } else {
            setSelectedConversation(null);
            setMessages([]);
        }
    };

    // ==============================
    // TYPING INDICATOR FUNCTIONS
    // ==============================

    const startTyping = useCallback(() => {
        if (!selectedConversation || !socket.connected) return;

        const receiverId = selectedConversation.isGroup
            ? null
            : selectedConversation.user?._id;

        if (!selectedConversation.isGroup && !receiverId) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;

            socket.emit("typing:start", {
                conversationId: selectedConversation._id,
                receiverId,
            });
        }

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Auto-stop typing after 3 seconds of no input
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping();
        }, 3000);
    }, [selectedConversation]);

    const stopTyping = useCallback(() => {
        if (!selectedConversation || !socket.connected) return;

        const receiverId = selectedConversation.isGroup
            ? null
            : selectedConversation.user?._id;

        if (!selectedConversation.isGroup && !receiverId) return;

        if (isTypingRef.current) {
            isTypingRef.current = false;

            socket.emit("typing:stop", {
                conversationId: selectedConversation._id,
                receiverId,
            });
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    }, [selectedConversation]);

    // ==============================
    // GROUP CHAT METHODS
    // ==============================
    const createGroup = async ({
        groupName,
        participants,
        groupAvatar = "",
        groupDescription = "",
    }) => {
        try {
            const response = await api.post("/conversations/group", {
                groupName,
                participants,
                groupAvatar,
                groupDescription,
            });

            if (response.data.success) {
                const newGroup = response.data.conversation;
                setConversations((prev) => [newGroup, ...prev]);
                setSelectedConversation(newGroup);
                setMessages([]);
                return newGroup;
            }
        } catch (error) {
            console.error("Create group error:", error);
            throw error;
        }
    };

    const updateGroup = async (groupId, data) => {
        try {
            const response = await api.put(`/conversations/group/${groupId}`, data);
            if (response.data.success) {
                const updated = response.data.conversation;
                setConversations((prev) =>
                    prev.map((c) => (c._id === groupId ? updated : c))
                );
                if (selectedConversation?._id === groupId) {
                    setSelectedConversation(updated);
                }
                return updated;
            }
        } catch (error) {
            console.error("Update group error:", error);
            throw error;
        }
    };

    const addGroupMembers = async (groupId, members) => {
        try {
            const response = await api.post(`/conversations/group/${groupId}/members`, {
                members,
            });
            if (response.data.success) {
                const updated = response.data.conversation;
                setConversations((prev) =>
                    prev.map((c) => (c._id === groupId ? updated : c))
                );
                if (selectedConversation?._id === groupId) {
                    setSelectedConversation(updated);
                }
                return updated;
            }
        } catch (error) {
            console.error("Add group members error:", error);
            throw error;
        }
    };

    const leaveOrRemoveGroupMember = async (groupId, memberId) => {
        try {
            const response = await api.delete(`/conversations/group/${groupId}/members/${memberId}`);
            if (response.data.success) {
                const { conversation: updated, removedMemberId } = response.data;
                const isMe = (removedMemberId?._id || removedMemberId)?.toString() === user?._id?.toString();
                if (isMe) {
                    // Current user left: update with isLeft: true so user can still view history
                    const leftConv = {
                        ...updated,
                        isLeft: true,
                        user: { ...updated.user, isLeft: true },
                    };
                    setConversations((prev) =>
                        prev.map((c) => (c._id === groupId ? leftConv : c))
                    );
                    if (selectedConversation?._id === groupId) {
                        setSelectedConversation(leftConv);
                    }
                } else {
                    setConversations((prev) =>
                        prev.map((c) => (c._id === groupId ? updated : c))
                    );
                    if (selectedConversation?._id === groupId) {
                        setSelectedConversation(updated);
                    }
                }
                return response.data;
            }
        } catch (error) {
            console.error("Remove group member error:", error);
            throw error;
        }
    };

    const deleteConversation = async (conversationId) => {
        if (!conversationId) return;
        try {
            const response = await api.delete(`/conversations/${conversationId}`);
            if (response.data.success) {
                setConversations((prev) => prev.filter((c) => c._id !== conversationId));
                if (selectedConversation?._id === conversationId) {
                    setSelectedConversation(null);
                    setMessages([]);
                }
                return response.data;
            }
        } catch (error) {
            console.error("Delete conversation error:", error);
            throw error;
        }
    };

    const toggleGroupAdmin = async (groupId, memberId) => {
        try {
            const response = await api.post(`/conversations/group/${groupId}/admins/${memberId}`);
            if (response.data.success) {
                const updated = response.data.conversation;
                setConversations((prev) =>
                    prev.map((c) => (c._id === groupId ? updated : c))
                );
                if (selectedConversation?._id === groupId) {
                    setSelectedConversation(updated);
                }
                return response.data;
            }
        } catch (error) {
            console.error("Toggle group admin error:", error);
            throw error;
        }
    };

    useEffect(() => {
        if (user) {
            getConversations();
        } else {
            setConversations([]);
            setLoading(false);
        }
    }, [user]);

    const getBlockedUsers = useCallback(async () => {
        try {
            const res = await api.get("/auth/blocked/all");
            if (res.data.success) {
                setBlockedUsers(res.data.blockedUsers || []);
            }
        } catch (err) {
            console.error("Failed to fetch blocked users:", err);
        }
    }, []);

    useEffect(() => {
        if (user) {
            getBlockedUsers();
        } else {
            setBlockedUsers([]);
        }
    }, [user, getBlockedUsers]);

    const toggleBlockUser = async (userId) => {
        try {
            const res = await api.post(`/auth/block/${userId}`);
            if (res.data.success) {
                await getBlockedUsers();
                return res.data;
            }
        } catch (err) {
            console.error("Failed to toggle block:", err);
            throw err;
        }
    };

    const isUserBlocked = useCallback(
        (userId) => {
            if (!userId) return false;
            const targetId = (userId?._id || userId).toString();
            return blockedUsers.some((b) => (b?._id || b).toString() === targetId);
        },
        [blockedUsers]
    );

    const clearChat = async (conversationId) => {
        if (!conversationId) return;
        try {
            const response = await api.post(`/messages/clear/${conversationId}`);
            if (response.data.success) {
                if (selectedConversation?._id === conversationId) {
                    setMessages([]);
                }
                await getConversations();
                return response.data;
            }
        } catch (error) {
            console.error("Clear chat error:", error);
            throw error;
        }
    };

    const value = {
        // Conversations
        conversations,
        loading,
        getConversations,
        openConversation,
        deleteConversation,

        // Messages
        messages,
        messagesLoading,
        selectedConversation,
        getMessages,
        selectConversation,
        sendMessage,
        reactToMessage,
        deleteMessage,
        toggleStarMessage,
        getStarredMessages,
        togglePinConversation,
        togglePinMessage,
        forwardMessage,
        clearChat,
        replyingTo,
        setReplyingTo,
        clearReplyingTo: () => setReplyingTo(null),

        // Multi-select messages
        selectedMessageIds,
        toggleSelectMessage,
        clearSelectedMessages,
        selectAllMessages,
        deleteSelectedMessages,
        starSelectedMessages,
        copySelectedMessages,

        // Blocked users
        blockedUsers,
        getBlockedUsers,
        toggleBlockUser,
        isUserBlocked,

        // Group chats
        createGroup,
        updateGroup,
        addGroupMembers,
        leaveOrRemoveGroupMember,
        toggleGroupAdmin,

        // Contacts
        contacts,
        contactsLoading,
        getContacts,
        addContact,

        // Search Users (Database direct lookup)
        searchUsers,

        // Typing
        typingUsers,
        startTyping,
        stopTyping,
    };


    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};




export default ChatProvider;