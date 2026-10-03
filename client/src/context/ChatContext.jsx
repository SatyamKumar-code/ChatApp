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

        const handleNewMessage = (message) => {
            console.log(
                "New message received:",
                message
            );

            setMessages((prev) => {
                // Prevent duplicate message
                const alreadyExists = prev.some(
                    (item) =>
                        item._id === message._id
                );

                if (alreadyExists) {
                    return prev;
                }

                return [...prev, message];
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

            // Update conversations list to reflect online status
            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.user?._id === onlineUserId) {
                        return {
                            ...conv,
                            user: { ...conv.user, isOnline: true },
                        };
                    }
                    return conv;
                })
            );
        };

        const handleUserOffline = (data) => {
            const { userId: offlineUserId, lastSeen } = data;

            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.user?._id === offlineUserId) {
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
        };

        socket.on("connect", handleConnect);
        socket.on("socket:connected", handleSocketConnected);
        socket.on("connect_error", handleConnectError);
        socket.on("disconnect", handleDisconnect);
        socket.on("newMessage", handleNewMessage);
        socket.on("message:delivered", handleMessageDelivered);
        socket.on("message:seen", handleMessageSeen);
        socket.on("typing:start", handleTypingStart);
        socket.on("typing:stop", handleTypingStop);
        socket.on("user:online", handleUserOnline);
        socket.on("user:offline", handleUserOffline);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("socket:connected", handleSocketConnected);
            socket.off("connect_error", handleConnectError);
            socket.off("disconnect", handleDisconnect);
            socket.off("newMessage", handleNewMessage);
            socket.off("message:delivered", handleMessageDelivered);
            socket.off("message:seen", handleMessageSeen);
            socket.off("typing:start", handleTypingStart);
            socket.off("typing:stop", handleTypingStop);
            socket.off("user:online", handleUserOnline);
            socket.off("user:offline", handleUserOffline);

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
                setConversations(response.data.conversations);
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

    const getMessages = async (conversationId) => {
        try {
            setMessagesLoading(true);

            const response = await api.get(
                `/messages/${conversationId}`
            );

            if (response.data.success) {
                setMessages(response.data.messages);
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

    const sendMessage = async (text) => {
        if (!selectedConversation) return;

        if (!text.trim()) return;

        if (!socket.connected) {
            throw new Error(
                "Socket is not connected"
            );
        }

        // Stop typing when sending
        stopTyping();

        socket.emit("sendMessage", {
            conversationId:
                selectedConversation._id,
            text: text.trim(),
        });
    };

    const selectConversation = async (conversation) => {
        setSelectedConversation(conversation);

        await getMessages(conversation._id);

        // Mark messages as seen when opening a conversation
        if (socket.connected) {
            socket.emit("message:markSeen", {
                conversationId: conversation._id,
            });
        }
    };

    // ==============================
    // TYPING INDICATOR FUNCTIONS
    // ==============================

    const startTyping = useCallback(() => {
        if (!selectedConversation || !socket.connected) return;

        const receiverId = selectedConversation.user?._id;
        if (!receiverId) return;

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

        const receiverId = selectedConversation.user?._id;
        if (!receiverId) return;

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

    useEffect(() => {
        if (user) {
            getConversations();
        } else {
            setConversations([]);
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            getContacts();
        }
    }, [user]);


    const value = {
        // Conversations
        conversations,
        loading,
        getConversations,
        openConversation,

        // Messages
        messages,
        messagesLoading,
        selectedConversation,
        getMessages,
        selectConversation,
        sendMessage,

        // Contacts
        contacts,
        contactsLoading,
        getContacts,
        addContact,

        // Typing
        typingUsers,
        startTyping,
        stopTyping,
    }


    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};




export default ChatProvider;