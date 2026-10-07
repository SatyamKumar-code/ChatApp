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
import {
    saveLocalFile,
    getLocalFile,
    hasLocalFile,
    saveSenderOriginal,
    getSenderOriginal,
    triggerDeviceDownload,
    getLocalPCPath,
} from "../services/localFileRegistry";
import {
    hasStoredDirectoryHandle,
    promptSelectChatAppDirectory,
} from "../services/fileSystemStorage";

export const ChatContext = createContext();

// Helper to decrypt both the message's own text and any quoted replyTo text
const decryptMsgPayload = async (msg, convId) => {
    if (!msg) return msg;
    const cid = convId || msg.conversation?._id || msg.conversation;
    let text = msg.text;
    if (text && cid) {
        try {
            text = await decryptMessage(text, cid);
        } catch (e) {
            console.error("Decrypt message text error:", e);
        }
    }
    let replyTo = msg.replyTo;
    if (replyTo && typeof replyTo === "object" && replyTo.text && cid) {
        try {
            const replyText = await decryptMessage(replyTo.text, cid);
            replyTo = { ...replyTo, text: replyText };
        } catch (e) {
            console.error("Decrypt replyTo text error:", e);
        }
    }
    return { ...msg, text, replyTo };
};

// Local storage cache helpers for full offline persistence
const loadCachedConversations = () => {
    try {
        const saved = localStorage.getItem("chatapp_cached_conversations");
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

const saveCachedConversations = (convs) => {
    try {
        localStorage.setItem("chatapp_cached_conversations", JSON.stringify(convs));
    } catch (e) {}
};

const loadCachedMessages = (convId) => {
    if (!convId) return [];
    try {
        const saved = localStorage.getItem(`chatapp_cached_msgs_${convId}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

const saveCachedMessages = (convId, msgs) => {
    if (!convId || !Array.isArray(msgs)) return;
    try {
        localStorage.setItem(`chatapp_cached_msgs_${convId}`, JSON.stringify(msgs.slice(-150)));
    } catch (e) {}
};

const loadCachedContacts = () => {
    try {
        const saved = localStorage.getItem("chatapp_cached_contacts");
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

const saveCachedContacts = (contacts) => {
    try {
        localStorage.setItem("chatapp_cached_contacts", JSON.stringify(contacts));
    } catch (e) {}
};

// Offline Outbox Queue (Messages sent while offline to be automatically dispatched when online)
const OUTBOX_STORAGE_KEY = "chatapp_offline_outbox_queue";

const loadOutbox = () => {
    try {
        const saved = localStorage.getItem(OUTBOX_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
};

const saveOutbox = (queue) => {
    try {
        localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {}
};

const ChatProvider = ({ children }) => {
    const { user } = useContext(AuthContext);

    const [conversations, setConversations] = useState(loadCachedConversations);
    const [loading, setLoading] = useState(() => loadCachedConversations().length === 0);

    const [contacts, setContacts] = useState(loadCachedContacts);
    const [contactsLoading, setContactsLoading] = useState(false);

    const [messages, setMessages] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);

    // Online / Offline tracking
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" ? !navigator.onLine : false);
    const [justReconnected, setJustReconnected] = useState(false);

    // Multi-select messages state
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);

    // Offline file delivery and transfer states
    // fileId -> { status, progress, loadedBytes, totalBytes, localUrl, error }
    const [fileTransfers, setFileTransfers] = useState({});
    const fileTransfersRef = useRef(fileTransfers);
    const activeDownloadsRef = useRef(new Map());

    useEffect(() => {
        fileTransfersRef.current = fileTransfers;
    }, [fileTransfers]);

    const [pendingOfflineFiles, setPendingOfflineFiles] = useState([]);

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

    // Auto-flush offline outbox messages when socket is connected and authenticated
    const isFlushingRef = useRef(false);

    const flushOutbox = useCallback(async () => {
        if (isFlushingRef.current) return;
        if (!socket || !socket.connected || !navigator.onLine) return;

        const queue = loadOutbox();
        if (!queue || queue.length === 0) return;

        isFlushingRef.current = true;
        console.log(`[OfflineSync] Flushing ${queue.length} pending messages from outbox...`);

        const remaining = [];
        for (const item of queue) {
            try {
                if (!socket.connected) {
                    remaining.push(item);
                    continue;
                }
                socket.emit("sendMessage", item.emitPayload);
                // Tiny delay between emits to preserve message ordering
                await new Promise((r) => setTimeout(r, 60));
            } catch (err) {
                console.error("[OfflineSync] Failed to emit queued message:", err);
                remaining.push(item);
            }
        }

        saveOutbox(remaining);
        isFlushingRef.current = false;
    }, []);

    useEffect(() => {
        if (!user) {
            if (socket.connected) {
                socket.disconnect();
            }

            return;
        }

        socket.connect();

        const handleConnect = () => {
            flushOutbox();
            if (selectedConversationRef.current?._id) {
                socket.emit("message:markSeen", {
                    conversationId: selectedConversationRef.current._id.toString(),
                });
            }
        };

        const handleSocketConnected = (data) => {
            flushOutbox();
            if (selectedConversationRef.current?._id) {
                socket.emit("message:markSeen", {
                    conversationId: selectedConversationRef.current._id.toString(),
                });
            }
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

            const convId = (message.conversation?._id || message.conversation)?.toString();
            const decryptedMessage = await decryptMsgPayload(message, convId);

            const activeConvId = (selectedConversationRef.current?._id)?.toString();
            const isForActiveConversation = Boolean(activeConvId && convId && activeConvId === convId);

            if (isForActiveConversation) {
                setMessages((prev) => {
                    const tempIdToMatch = message.tempId || decryptedMessage.tempId;

                    // 1. Check if real ID is already in list
                    const realExistsIndex = prev.findIndex(
                        (item) => item._id?.toString() === decryptedMessage._id?.toString()
                    );

                    // 2. Find matching optimistic message to replace:
                    // Match by tempId, or by temp_ prefix with same sender & content
                    const optimisticIndex = prev.findIndex((m) => {
                        if (tempIdToMatch && (m.tempId === tempIdToMatch || m._id === tempIdToMatch)) {
                            return true;
                        }
                        if (typeof m._id === "string" && (m._id.startsWith("temp_") || m.tempId)) {
                            const mSender = (m.sender?._id || m.sender)?.toString();
                            const dSender = (decryptedMessage.sender?._id || decryptedMessage.sender)?.toString();
                            if (mSender && dSender && mSender === dSender) {
                                if (m.text && decryptedMessage.text && m.text.trim() === decryptedMessage.text.trim()) {
                                    return true;
                                }
                                if (m.fileUrl && decryptedMessage.fileUrl && m.fileUrl === decryptedMessage.fileUrl) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    });

                    // Preserve existing fileUrl (e.g. localPreviewUrl) if decryptedMessage has empty fileUrl
                    const existingFileUrl =
                        (realExistsIndex !== -1 ? prev[realExistsIndex]?.fileUrl : "") ||
                        (optimisticIndex !== -1 ? prev[optimisticIndex]?.fileUrl : "") ||
                        "";
                    const mergedMessage = {
                        ...decryptedMessage,
                        fileUrl: decryptedMessage.fileUrl || existingFileUrl,
                    };

                    let updated;
                    if (realExistsIndex !== -1) {
                        // Real message already exists: keep it updated and remove any leftover optimistic item
                        updated = prev.map((m, idx) => (idx === realExistsIndex ? mergedMessage : m));
                        if (optimisticIndex !== -1 && optimisticIndex !== realExistsIndex) {
                            updated = updated.filter((_, idx) => idx !== optimisticIndex);
                        }
                    } else if (optimisticIndex !== -1) {
                        // Replace the optimistic message in-place with the server-confirmed message
                        updated = [...prev];
                        updated[optimisticIndex] = mergedMessage;
                    } else {
                        // New incoming message from partner: append
                        updated = [...prev, mergedMessage];
                    }

                    // Extra deduplication safeguard: purge any duplicate entries matching tempId or real ID
                    if (tempIdToMatch) {
                        updated = updated.filter(
                            (m) =>
                                m._id?.toString() === decryptedMessage._id?.toString() ||
                                (m._id !== tempIdToMatch && m.tempId !== tempIdToMatch)
                        );
                    }

                    if (convId) {
                        saveCachedMessages(convId, updated);
                    }

                    // Auto-download images in background so both sender and receiver see photo directly
                    if (mergedMessage.messageType === "image" && mergedMessage.fileId) {
                        const fid = mergedMessage.fileId;
                        if (!fileTransfersRef.current?.[fid]?.localUrl) {
                            setTimeout(() => {
                                downloadAndSaveFile({
                                    fileId: fid,
                                    fileName: mergedMessage.fileName || "image.png",
                                    fileType: "image",
                                    fileSize: mergedMessage.fileSize || 0,
                                    messageId: mergedMessage._id,
                                    isUserGesture: false,
                                }).catch(() => {});
                            }, 50);
                        }
                    }

                    return updated;
                });
            } else if (convId) {
                // Background conversation message: update cached messages
                try {
                    const cached = loadCachedMessages(convId);
                    if (cached && cached.length > 0) {
                        const tempIdToMatch = message.tempId || decryptedMessage.tempId;
                        const filtered = cached.filter(
                            (m) =>
                                m._id?.toString() !== decryptedMessage._id?.toString() &&
                                (!tempIdToMatch || (m._id !== tempIdToMatch && m.tempId !== tempIdToMatch))
                        );
                        saveCachedMessages(convId, [...filtered, decryptedMessage]);
                    }
                } catch (e) {}
            }

            // Immediately update sidebar conversation preview with confirmed message
            if (convId) {
                setConversations((prev) =>
                    prev.map((c) => {
                        const cId = (c._id?.toString() || c._id);
                        if (cId === convId) {
                            return {
                                ...c,
                                lastMessage: decryptedMessage,
                                lastMessageAt: decryptedMessage.createdAt,
                            };
                        }
                        return c;
                    })
                );
            }

            // Clean up outbox queue if matching item is confirmed
            try {
                const currentQueue = loadOutbox();
                if (currentQueue && currentQueue.length > 0) {
                    const filtered = currentQueue.filter((item) => {
                        if (message.tempId && item.tempId === message.tempId) return false;
                        if (item.conversationId === convId && item.plainText === decryptedMessage.text) return false;
                        return true;
                    });
                    if (filtered.length !== currentQueue.length) {
                        saveOutbox(filtered);
                    }
                }
            } catch (e) {}

            // If the message is for the currently open conversation and I did not send it,
            // immediately mark it as seen
            const currentConv = selectedConversationRef.current;
            const msgConvId = (message.conversation?._id || message.conversation)?.toString();
            const currentConvId = currentConv?._id?.toString();
            const myId = (user?._id || user?.id)?.toString();
            const msgSenderId = (message.sender?._id || message.sender)?.toString();

            if (
                currentConvId &&
                msgConvId &&
                currentConvId === msgConvId &&
                msgSenderId &&
                msgSenderId !== myId
            ) {
                socket.emit("message:markSeen", {
                    conversationId: currentConvId,
                });
            }

            // Refresh chat list
            getConversations();

            // Play sound chime if message was sent by someone else
            if (msgSenderId && msgSenderId !== myId) {
                playMessageSound();
            }
        };

        // ==============================
        // DELIVERED STATUS HANDLER
        // ==============================
        const handleMessageDelivered = (data) => {
            const { messages: deliveredMsgs } = data;

            if (!deliveredMsgs || deliveredMsgs.length === 0) return;

            const deliveredSet = new Set(
                deliveredMsgs.map((d) => (d.messageId?.toString() || d.toString()))
            );

            setMessages((prev) => {
                const updated = prev.map((msg) => {
                    const idStr = (msg._id?.toString() || msg._id);
                    const tempIdStr = msg.tempId?.toString();
                    if (deliveredSet.has(idStr) || (tempIdStr && deliveredSet.has(tempIdStr))) {
                        return { ...msg, isDelivered: true };
                    }
                    return msg;
                });

                const activeConvId = selectedConversationRef.current?._id?.toString();
                if (activeConvId) {
                    saveCachedMessages(activeConvId, updated);
                }
                return updated;
            });

            // Update conversation list to reflect delivered status
            getConversations();
        };

        // ==============================
        // SEEN STATUS HANDLER
        // ==============================
        const handleMessageSeen = (data) => {
            if (!data) return;
            const {
                conversationId,
                messages: seenMsgs,
                seenAt,
            } = data;

            const convIdStr = (conversationId?._id || conversationId)?.toString();
            const myId = (user?._id || user?.id)?.toString();

            const seenSet = new Set(
                (seenMsgs || [])
                    .map((s) => (s?.messageId?.toString() || s?._id?.toString() || s?.toString()))
                    .filter(Boolean)
            );

            setMessages((prev) => {
                const activeConvId = selectedConversationRef.current?._id?.toString();
                const isForCurrentConv = Boolean(activeConvId && convIdStr && activeConvId === convIdStr);

                const updated = prev.map((msg) => {
                    const idStr = (msg._id?.toString() || msg._id);
                    const tempIdStr = msg.tempId?.toString();
                    const msgConvId = (msg.conversation?._id || msg.conversation)?.toString();
                    const msgSenderId = (msg.sender?._id || msg.sender)?.toString();

                    const isSentByMe = Boolean(myId && msgSenderId && myId === msgSenderId);
                    const isMatchedById = Boolean((idStr && seenSet.has(idStr)) || (tempIdStr && seenSet.has(tempIdStr)));
                    const isMatchedByConv = Boolean(isSentByMe && (isForCurrentConv || (convIdStr && msgConvId === convIdStr)));

                    if (isMatchedById || isMatchedByConv) {
                        return {
                            ...msg,
                            isSeen: true,
                            isDelivered: true,
                            seenAt: seenAt || msg.seenAt || new Date().toISOString(),
                        };
                    }
                    return msg;
                });

                if (activeConvId) {
                    saveCachedMessages(activeConvId, updated);
                }
                return updated;
            });

            // Immediately update sidebar conversation list
            if (convIdStr) {
                setConversations((prev) =>
                    prev.map((c) => {
                        if (c._id?.toString() === convIdStr) {
                            if (c.lastMessage) {
                                return {
                                    ...c,
                                    lastMessage: {
                                        ...c.lastMessage,
                                        isSeen: true,
                                        isDelivered: true,
                                    },
                                };
                            }
                        }
                        return c;
                    })
                );
            }

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
                (pinnedMessages || []).map((msg) => decryptMsgPayload(msg, conversationId))
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

        // ==============================
        // OFFLINE FILE TRANSFER SOCKET HANDLERS
        // ==============================
        const handleFilePendingList = (data) => {
            const { pendingFiles } = data || {};
            if (Array.isArray(pendingFiles)) {
                setPendingOfflineFiles(pendingFiles);
                setFileTransfers((prev) => {
                    const updated = { ...prev };
                    pendingFiles.forEach((f) => {
                        if (!updated[f.fileId] || updated[f.fileId].status !== "downloaded") {
                            updated[f.fileId] = {
                                status: f.status || "download_available",
                                progress: 0,
                                fileSize: f.fileSize,
                                fileName: f.fileName,
                                fileType: f.fileType,
                            };
                        }
                    });
                    return updated;
                });
            }
        };

        const handleFileAvailable = (data) => {
            const { fileId, fileName, fileSize, fileType, status, messageId } = data || {};
            if (fileId) {
                setFileTransfers((prev) => ({
                    ...prev,
                    [fileId]: {
                        status: status || "download_available",
                        progress: 0,
                        fileSize,
                        fileName,
                        fileType,
                    },
                }));

                // Auto-download images immediately so receiver views photo directly in chat bubble
                if (fileType === "image" && !fileTransfersRef.current?.[fileId]?.localUrl) {
                    setTimeout(() => {
                        downloadAndSaveFile({
                            fileId,
                            fileName: fileName || "image.png",
                            fileType: "image",
                            fileSize: fileSize || 0,
                            messageId,
                            isUserGesture: false,
                        }).catch(() => {});
                    }, 50);
                }
            }
        };

        const handleFileStatusUpdate = (data) => {
            const { fileId, status, messageId, receiverOnline } = data || {};
            if (!fileId) return;

            setFileTransfers((prev) => {
                const existing = prev[fileId] || {};
                return {
                    ...prev,
                    [fileId]: {
                        ...existing,
                        status: status || existing.status,
                        receiverOnline: typeof receiverOnline === "boolean" ? receiverOnline : existing.receiverOnline,
                    },
                };
            });

            setMessages((prev) =>
                prev.map((m) => {
                    if (m.fileId === fileId || (messageId && m._id?.toString() === messageId.toString())) {
                        return {
                            ...m,
                            fileTransferStatus: status,
                            fileDelivery: m.fileDelivery ? { ...m.fileDelivery, status } : { fileId, status },
                        };
                    }
                    return m;
                })
            );
        };

        const handleRequestReupload = async (data) => {
            const { fileId, fileName } = data || {};
            if (!fileId) return;
            try {
                console.log(`[OfflineSync] Sender received re-upload request for file: ${fileId}`);
                const originalBlob = await getSenderOriginal(fileId);
                if (!originalBlob) {
                    console.warn(`[OfflineSync] Original file missing from local registry: ${fileId}`);
                    if (socket && socket.connected) {
                        socket.emit("file:reupload_failed", { fileId, reason: "original_deleted" });
                    }
                    await api.post("/files/reupload-failed", { fileId }).catch(() => {});
                    return;
                }

                const formData = new FormData();
                formData.append("fileId", fileId);
                formData.append("file", originalBlob, fileName || "attachment");

                await api.post("/files/reupload", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                console.log(`[OfflineSync] Successfully re-uploaded original file: ${fileId}`);
            } catch (err) {
                console.error("[OfflineSync] Re-upload error:", err);
                if (socket && socket.connected) {
                    socket.emit("file:reupload_failed", { fileId, reason: err.message });
                }
            }
        };

        const handleReuploadReady = (data) => {
            const { fileId } = data || {};
            if (fileId) {
                setFileTransfers((prev) => ({
                    ...prev,
                    [fileId]: {
                        ...(prev[fileId] || {}),
                        status: "download_available",
                    },
                }));
                setMessages((prev) =>
                    prev.map((m) =>
                        m.fileId === fileId
                            ? { ...m, fileTransferStatus: "download_available" }
                            : m
                    )
                );
            }
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

        // Offline file delivery listeners
        socket.on("file:pending_list", handleFilePendingList);
        socket.on("file:available", handleFileAvailable);
        socket.on("file:status_update", handleFileStatusUpdate);
        socket.on("file:request_reupload", handleRequestReupload);
        socket.on("file:reupload_ready", handleReuploadReady);

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

            socket.off("file:pending_list", handleFilePendingList);
            socket.off("file:available", handleFileAvailable);
            socket.off("file:status_update", handleFileStatusUpdate);
            socket.off("file:request_reupload", handleRequestReupload);
            socket.off("file:reupload_ready", handleReuploadReady);

            socket.disconnect();
        };
    }, [user]);

    // Full PWA, Mobile, and Cross-Browser Presence Sync (WhatsApp-Style)
    useEffect(() => {
        if (!user) return;

        let hideTimer = null;

        const markOffline = () => {
            try {
                if (socket && socket.connected) {
                    socket.emit("user:going_offline");
                    socket.disconnect();
                }

                const serverUrl = import.meta.env.VITE_SERVER_URL;
                if (serverUrl && user?._id) {
                    const payload = JSON.stringify({ userId: user._id });

                    // 1. Try navigator.sendBeacon (native browser OS background worker)
                    if (navigator.sendBeacon) {
                        const blob = new Blob([payload], { type: "application/json" });
                        navigator.sendBeacon(`${serverUrl}/api/auth/offline`, blob);
                    }

                    // 2. Also send keepalive fetch with credentials
                    fetch(`${serverUrl}/api/auth/offline`, {
                        method: "POST",
                        credentials: "include",
                        keepalive: true,
                        headers: { "Content-Type": "application/json" },
                        body: payload,
                    }).catch(() => {});
                }
            } catch (e) {}
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                // If user minimized PWA, locked screen, or switched app, mark offline after 2 seconds
                hideTimer = setTimeout(() => {
                    markOffline();
                }, 2000);
            } else if (document.visibilityState === "visible") {
                if (hideTimer) {
                    clearTimeout(hideTimer);
                    hideTimer = null;
                }
                // When coming back into the PWA/tab, reconnect immediately
                if (!socket.connected && user) {
                    socket.connect();
                } else if (socket.connected && selectedConversationRef.current?._id) {
                    socket.emit("message:markSeen", {
                        conversationId: selectedConversationRef.current._id.toString(),
                    });
                }
            }
        };

        const handleImmediateUnload = () => {
            if (hideTimer) clearTimeout(hideTimer);
            markOffline();
        };

        window.addEventListener("beforeunload", handleImmediateUnload);
        window.addEventListener("pagehide", handleImmediateUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (hideTimer) clearTimeout(hideTimer);
            window.removeEventListener("beforeunload", handleImmediateUnload);
            window.removeEventListener("pagehide", handleImmediateUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [user]);

    // Network connectivity listener: sync latest data when coming back online
    useEffect(() => {
        const handleOnline = async () => {
            setIsOffline(false);
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3500);

            if (!socket.connected && user) {
                socket.connect();
            }

            // Immediately flush any offline pending outbox messages
            flushOutbox();

            // Sync latest chats & contacts from server
            getConversations();
            getContacts();

            // Sync latest messages for the active conversation
            if (selectedConversationRef.current?._id) {
                getMessages(selectedConversationRef.current._id);
            }
        };

        const handleOffline = () => {
            setIsOffline(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
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
            if (contacts.length === 0) setContactsLoading(true);

            const response = await api.get("/contacts");

            if (response.data.success) {
                setContacts(response.data.contacts);
                saveCachedContacts(response.data.contacts);
            }
        } catch (error) {
            console.warn("Get contacts error / offline, keeping cached contacts:", error);
        } finally {
            setContactsLoading(false);
        }
    };

    const getConversations = async () => {
        try {
            if (conversations.length === 0) setLoading(true);

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
                saveCachedConversations(decryptedConvs);
            }
        } catch (error) {
            console.warn("Get conversations error / offline, keeping cached conversations:", error);
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
        if (!conversationId) return;

        // Immediately load cached messages so the screen displays instantly
        const cached = loadCachedMessages(conversationId);
        if (cached && cached.length > 0) {
            setMessages(cached);
        }

        try {
            if (cached.length === 0) {
                setMessagesLoading(true);
            }

            const response = await api.get(
                `/messages/${conversationId}`
            );

            if (response.data.success) {
                const rawMsgs = response.data.messages || [];
                const decryptedMsgs = await Promise.all(
                    rawMsgs.map((msg) => decryptMsgPayload(msg, conversationId))
                );

                // Preserve any pending optimistic messages that are waiting to be sent
                setMessages((prev) => {
                    const pendingMsgs = prev.filter(
                        (m) =>
                            (m.isPending || m.status === "pending") &&
                            !decryptedMsgs.some(
                                (dm) =>
                                    dm._id === m._id ||
                                    (m.tempId && dm.tempId === m.tempId) ||
                                    (dm.text === m.text && (dm.sender?._id || dm.sender)?.toString() === (m.sender?._id || m.sender)?.toString())
                            )
                    );
                    const combined = [...decryptedMsgs, ...pendingMsgs];
                    saveCachedMessages(conversationId, combined);
                    return combined;
                });

                if (socket.connected) {
                    socket.emit("message:markSeen", {
                        conversationId: conversationId.toString(),
                    });
                }
            }
        } catch (error) {
            console.warn("Get messages error / offline, keeping cached messages:", error);
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

        if (!text && !fileUrl && !data.file) return;

        const replyToId = data.replyTo || replyingTo?._id || null;

        // If a physical file is provided, use offline file delivery system with circular progress
        if (data.file) {
            return uploadAndSendFile({
                file: data.file,
                caption: text,
                fileType: data.messageType,
                replyTo: replyToId,
                width: data.width,
                height: data.height,
                duration: data.duration,
                pageCount: data.pageCount,
            });
        }

        // Stop typing when sending
        stopTyping();

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const isOnlineAndConnected = Boolean(socket && socket.connected && navigator.onLine);

        // Optimistic message object for immediate UI presentation
        const optimisticMsg = {
            _id: tempId,
            tempId,
            conversation: selectedConversation._id,
            sender: user,
            receiver: selectedConversation.isGroup ? null : (selectedConversation.user?._id || selectedConversation.user),
            text, // Plain text for local display
            fileUrl,
            fileName: data.fileName || "",
            fileSize: data.fileSize || 0,
            duration: data.duration || 0,
            messageType: data.messageType || (fileUrl ? (fileUrl.startsWith("data:audio") ? "audio" : fileUrl.startsWith("data:image") ? "image" : "file") : "text"),
            replyTo: replyingTo ? { ...replyingTo } : null,
            createdAt: new Date().toISOString(),
            isPending: !isOnlineAndConnected,
            status: !isOnlineAndConnected ? "pending" : "sent",
            isDelivered: false,
            isSeen: false,
        };

        // Immediately update current messages state and cache
        setMessages((prev) => {
            const updated = [...prev, optimisticMsg];
            saveCachedMessages(selectedConversation._id, updated);
            return updated;
        });

        // Update conversation list sidebar with optimistic preview
        setConversations((prev) =>
            prev.map((c) =>
                c._id === selectedConversation._id
                    ? {
                          ...c,
                          lastMessage: {
                              _id: tempId,
                              text,
                              sender: user._id,
                              createdAt: optimisticMsg.createdAt,
                          },
                          lastMessageAt: optimisticMsg.createdAt,
                      }
                    : c
            )
        );

        setReplyingTo(null);

        // Encrypt message text
        let encryptedText = text;
        try {
            if (text) {
                encryptedText = await encryptMessage(text, selectedConversation._id);
            }
        } catch (err) {
            console.error("Encryption error in sendMessage:", err);
        }

        const emitPayload = {
            tempId,
            conversationId: selectedConversation._id,
            text: encryptedText,
            fileUrl,
            fileName: data.fileName || "",
            fileSize: data.fileSize || 0,
            duration: data.duration || 0,
            messageType: optimisticMsg.messageType,
            replyTo: replyToId,
        };

        if (!isOnlineAndConnected) {
            // Queue in localStorage outbox
            const queue = loadOutbox();
            queue.push({
                tempId,
                conversationId: selectedConversation._id,
                emitPayload,
                plainText: text,
                createdAt: optimisticMsg.createdAt,
            });
            saveOutbox(queue);
            console.log("[OfflineSync] Message saved to offline outbox:", tempId);
            return;
        }

        // Online & connected: transmit through socket
        socket.emit("sendMessage", emitPayload);
    };

    /**
     * Upload and send file via temporary encrypted server storage
     * Supports WhatsApp-style circular upload progress & offline asynchronous delivery
     */
    const uploadAndSendFile = async ({
        file,
        caption = "",
        fileType = null,
        replyTo = null,
        width = null,
        height = null,
        duration = 0,
        pageCount = null,
    }) => {
        if (!selectedConversation || !file) return;

        // Auto-detect fileType
        const mime = file.type || "";
        let detectedType = fileType;
        if (!detectedType) {
            if (mime.startsWith("image/")) detectedType = "image";
            else if (mime.startsWith("video/")) detectedType = "video";
            else detectedType = "document";
        }

        const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const replyToId = replyTo || replyingTo?._id || null;
        const receiverId = selectedConversation.isGroup
            ? null
            : (selectedConversation.user?._id || selectedConversation.user);

        // 1. Store sender's original file in local registry (non-blocking)
        saveSenderOriginal(fileId, file, {
            fileType: detectedType,
            fileName: file.name,
            fileSize: file.size,
            mimeType: mime,
        }).catch((e) => {
            console.warn("Failed to save sender original file:", e);
        });

        // 2. Create local object URL for instant preview on sender device
        const localPreviewUrl = URL.createObjectURL(file);

        // 3. Optimistic message presentation with circular progress indicator
        const optimisticMsg = {
            _id: tempId,
            tempId,
            conversation: selectedConversation._id,
            sender: user,
            receiver: receiverId,
            text: caption,
            messageType: detectedType,
            fileId,
            fileName: file.name,
            fileSize: file.size,
            fileTransferStatus: "uploading",
            fileDelivery: {
                fileId,
                status: "uploading",
                fileName: file.name,
                fileSize: file.size,
                fileType: detectedType,
            },
            fileUrl: detectedType === "image" ? localPreviewUrl : "",
            createdAt: new Date().toISOString(),
            isPending: false,
            status: "sent",
            isDelivered: false,
            isSeen: false,
            replyTo: replyingTo ? { ...replyingTo } : null,
        };

        setFileTransfers((prev) => ({
            ...prev,
            [fileId]: {
                status: "uploading",
                progress: 0,
                loadedBytes: 0,
                totalBytes: file.size,
                localUrl: localPreviewUrl,
            },
        }));

        setMessages((prev) => {
            const updated = [...prev, optimisticMsg];
            saveCachedMessages(selectedConversation._id, updated);
            return updated;
        });

        setConversations((prev) =>
            prev.map((c) =>
                c._id === selectedConversation._id
                    ? {
                          ...c,
                          lastMessage: {
                              _id: tempId,
                              text: caption || `Shared ${detectedType}`,
                              sender: user._id,
                              createdAt: optimisticMsg.createdAt,
                          },
                          lastMessageAt: optimisticMsg.createdAt,
                      }
                    : c
            )
        );

        setReplyingTo(null);

        // 4. Multi-part streaming upload using XMLHttpRequest for real-time circular progress
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileId", fileId);
        formData.append("conversationId", selectedConversation._id);
        if (receiverId) formData.append("receiverId", receiverId);
        formData.append("fileType", detectedType);
        formData.append("caption", caption);
        if (replyToId) formData.append("replyTo", replyToId);
        formData.append("tempId", tempId);
        if (width) formData.append("width", width);
        if (height) formData.append("height", height);
        if (duration) formData.append("duration", duration);
        if (pageCount) formData.append("pageCount", pageCount);
        formData.append("originalSenderPath", getLocalPCPath(file.name, detectedType, "Send"));

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${import.meta.env.VITE_SERVER_URL}/api/files/upload`);
            xhr.withCredentials = true;

            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable) {
                    const progress = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: progress >= 100 ? "uploaded" : "uploading",
                            progress,
                            loadedBytes: evt.loaded,
                            totalBytes: evt.total,
                            localUrl: localPreviewUrl,
                        },
                    }));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const resData = JSON.parse(xhr.responseText);
                        const confirmedMsg = resData.message;

                        setFileTransfers((prev) => ({
                            ...prev,
                            [fileId]: {
                                status: "pending_delivery",
                                progress: 100,
                                loadedBytes: file.size,
                                totalBytes: file.size,
                                localUrl: localPreviewUrl,
                            },
                        }));

                        setMessages((prev) => {
                            const updated = prev.map((m) =>
                                m.tempId === tempId || m._id === tempId
                                    ? {
                                          ...confirmedMsg,
                                          fileUrl: m.fileUrl || confirmedMsg.fileUrl || localPreviewUrl,
                                          fileTransferStatus: "pending_delivery",
                                      }
                                    : m
                            );
                            saveCachedMessages(selectedConversation._id, updated);
                            return updated;
                        });

                        resolve(confirmedMsg);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "failed",
                            progress: 0,
                            error: "Upload failed",
                        },
                    }));
                    reject(new Error("Upload failed with status " + xhr.status));
                }
            };

            xhr.onerror = () => {
                setFileTransfers((prev) => ({
                    ...prev,
                    [fileId]: {
                        status: "failed",
                        progress: 0,
                        error: "Network error",
                    },
                }));
                reject(new Error("Network error during file upload"));
            };

            xhr.send(formData);
        });
    };

    /**
     * Download file with WhatsApp-style circular progress & save to local storage
     * Triggers acknowledgement so server deletes temporary file!
     */
    const downloadAndSaveFile = async ({
        fileId,
        fileName,
        fileType,
        fileSize,
        messageId,
        isUserGesture = false,
    }) => {
        if (!fileId) return;

        // Prevent duplicate concurrent downloads for the same file
        if (activeDownloadsRef.current.has(fileId)) {
            return activeDownloadsRef.current.get(fileId);
        }

        const downloadTask = (async () => {
            // Check if already in local registry
            try {
                const existing = await getLocalFile(fileId);
                if (existing && existing.objectUrl) {
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "downloaded",
                            progress: 100,
                            localUrl: existing.objectUrl,
                        },
                    }));
                    return existing.objectUrl;
                }
            } catch (e) {
                console.warn("Error checking existing local file:", e);
            }

            // On PC desktop, prompt user to link Downloads folder ONLY if this was an explicit user gesture (not background auto-download)
            if (isUserGesture && typeof window !== "undefined" && typeof window.showDirectoryPicker === "function") {
                try {
                    const hasHandle = await hasStoredDirectoryHandle();
                    if (!hasHandle) {
                        await promptSelectChatAppDirectory();
                    }
                } catch (e) {
                    // User dismissed or cancelled directory picker, will fall back to browser download
                }
            }

            setFileTransfers((prev) => ({
                ...prev,
                [fileId]: {
                    status: "downloading",
                    progress: 0,
                    loadedBytes: 0,
                    totalBytes: fileSize || 0,
                },
            }));

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("GET", `${import.meta.env.VITE_SERVER_URL}/api/files/download/${fileId}`);
                xhr.withCredentials = true;
                xhr.responseType = "blob";

                xhr.onprogress = (evt) => {
                    const total = evt.lengthComputable ? evt.total : fileSize || 0;
                    const loaded = evt.loaded;
                    const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 50;

                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "downloading",
                            progress,
                            loadedBytes: loaded,
                            totalBytes: total,
                        },
                    }));
                };

                xhr.onload = async () => {
                    if (xhr.status === 200) {
                        try {
                            const blob = xhr.response;

                            // 1. Save permanently to local IndexedDB registry & native disk if permitted
                            const saved = await saveLocalFile({
                                fileId,
                                messageId,
                                blob,
                                fileName,
                                fileType,
                                mimeType: blob.type,
                                fileSize: blob.size,
                                direction: "Received",
                            });

                            // 2. Trigger browser download popup ONLY for documents/manual downloads (not auto-downloaded photos)
                            if (!saved?.savedToDisk && isUserGesture && fileType !== "image") {
                                triggerDeviceDownload(blob, fileName, fileType, "Received");
                            }

                            // 3. Acknowledge download completion
                            api.post(`/files/acknowledge/${fileId}`).catch(() => {});
                            if (socket && socket.connected) {
                                socket.emit("file:download_complete", { fileId });
                            }

                            const objectUrl = saved?.objectUrl || URL.createObjectURL(blob);

                            setFileTransfers((prev) => ({
                                ...prev,
                                [fileId]: {
                                    status: "downloaded",
                                    progress: 100,
                                    localUrl: objectUrl,
                                },
                            }));

                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.fileId === fileId
                                        ? {
                                              ...m,
                                              fileTransferStatus: "downloaded",
                                              fileUrl: objectUrl,
                                          }
                                        : m
                                )
                            );

                            resolve(objectUrl);
                        } catch (err) {
                            console.error("Save local file error:", err);
                            reject(err);
                        }
                    } else if (xhr.status === 410) {
                        // Expired on server
                        setFileTransfers((prev) => ({
                            ...prev,
                            [fileId]: {
                                status: "expired",
                                progress: 0,
                                error: "File is no longer available on server",
                            },
                        }));
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.fileId === fileId
                                    ? { ...m, fileTransferStatus: "expired" }
                                    : m
                            )
                        );
                        reject(new Error("File expired"));
                    } else {
                        setFileTransfers((prev) => ({
                            ...prev,
                            [fileId]: {
                                status: "failed",
                                progress: 0,
                                error: "Download failed",
                            },
                        }));
                        reject(new Error("Download failed: " + xhr.status));
                    }
                };

                xhr.onerror = () => {
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "failed",
                            progress: 0,
                            error: "Network error",
                        },
                    }));
                    reject(new Error("Network error during file download"));
                };

                xhr.send();
            });
        })();

        activeDownloadsRef.current.set(fileId, downloadTask);
        try {
            return await downloadTask;
        } finally {
            activeDownloadsRef.current.delete(fileId);
        }
    };

    /**
     * Request redownload ("Download Again") with recovery logic
     */
    const requestFileRedownload = async (fileParams) => {
        const { fileId, fileName, fileType, fileSize, messageId } = fileParams || {};
        if (!fileId) return;

        setFileTransfers((prev) => ({
            ...prev,
            [fileId]: {
                status: "checking_sender",
                progress: 0,
            },
        }));

        try {
            const res = await api.post(`/files/redownload-request/${fileId}`);
            if (res.data?.success) {
                if (res.data.status === "available") {
                    return downloadAndSaveFile({
                        fileId,
                        fileName,
                        fileType,
                        fileSize,
                        messageId,
                    });
                } else if (res.data.status === "checking_sender") {
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "checking_sender",
                            message: "Temporary copy unavailable. Checking sender's original file...",
                        },
                    }));
                } else if (res.data.status === "waiting_for_sender") {
                    setFileTransfers((prev) => ({
                        ...prev,
                        [fileId]: {
                            status: "waiting_for_sender",
                            message: "Waiting for sender to come online to re-send file...",
                        },
                    }));
                }
            }
        } catch (err) {
            console.error("Redownload request error:", err);
            setFileTransfers((prev) => ({
                ...prev,
                [fileId]: {
                    status: "unavailable",
                    message: "File is currently unavailable.",
                },
            }));
        }
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
                updatedPinned.map((msg) => decryptMsgPayload(msg, convId))
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
                list.map((msg) => decryptMsgPayload(msg))
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
                    conversation.pinnedMessages.map((pm) => decryptMsgPayload(pm, conversation._id))
                );
                convToSet = { ...convToSet, pinnedMessages: decryptedPinned };
            }
            setSelectedConversation(convToSet);

            // Immediately load cached messages for this conversation
            const cached = loadCachedMessages(conversation._id);
            if (cached && cached.length > 0) {
                setMessages(cached);
            }

            await getMessages(conversation._id);

            // Mark messages as seen when opening a conversation
            if (socket.connected) {
                socket.emit("message:markSeen", {
                    conversationId: (conversation._id?.toString() || conversation._id),
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

        // Typing indicator
        typingUsers,
        startTyping,
        stopTyping,

        // Online / Offline tracking
        isOffline,
        justReconnected,

        // Offline File Transfer & Asynchronous Delivery
        fileTransfers,
        pendingOfflineFiles,
        uploadAndSendFile,
        downloadAndSaveFile,
        requestFileRedownload,
    };


    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};




export default ChatProvider;