import { useContext, useEffect, useRef, useState } from "react";

import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

// ==============================
// MESSAGE STATUS COMPONENT
// ==============================
const MessageStatus = ({ message, isMyMessage }) => {
    if (!isMyMessage) return null;

    let statusIcon = "";
    let statusColor = "#999";

    if (message.isSeen) {
        statusIcon = "✓✓";
        statusColor = "#4fc3f7"; // Blue double tick
    } else if (message.isDelivered) {
        statusIcon = "✓✓";
        statusColor = "#999"; // Grey double tick
    } else {
        statusIcon = "✓";
        statusColor = "#999"; // Single grey tick (sent)
    }

    return (
        <span
            style={{
                marginLeft: "6px",
                fontSize: "12px",
                color: statusColor,
                fontWeight: "bold",
                letterSpacing: "-1px",
            }}
        >
            {statusIcon}
        </span>
    );
};

const ChatHome = () => {
    const { user, logout } = useContext(AuthContext);

    const {
        conversations,
        loading,
        selectConversation,
        sendMessage,
        selectedConversation,
        messages,
        messagesLoading,
        contacts,
        contactsLoading,
        getContacts,
        addContact,
        openConversation,
        typingUsers,
        startTyping,
        stopTyping,
    } = useContext(ChatContext);

    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);

    // Contact form state
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactPhone, setContactPhone] = useState("");
    const [contactName, setContactName] = useState("");
    const [addingContact, setAddingContact] = useState(false);
    const [contactError, setContactError] = useState("");

    // Show contacts panel
    const [showContacts, setShowContacts] = useState(false);

    // Auto scroll to bottom
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages]);

    // Send message
    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!messageText.trim()) return;
        if (!selectedConversation) return;

        try {
            setSending(true);

            await sendMessage(messageText);

            // Clear input after successful message
            setMessageText("");
        } catch (error) {
            console.error("Send message error:", error);
        } finally {
            setSending(false);
        }
    };

    // Handle typing
    const handleInputChange = (e) => {
        setMessageText(e.target.value);

        if (e.target.value.trim()) {
            startTyping();
        } else {
            stopTyping();
        }
    };

    // Add contact by phone number
    const handleAddContact = async (e) => {
        e.preventDefault();

        if (!contactPhone.trim()) return;

        try {
            setAddingContact(true);
            setContactError("");

            await addContact(contactPhone, contactName);

            setContactPhone("");
            setContactName("");
            setShowContactForm(false);
        } catch (error) {
            setContactError(
                error.response?.data?.message ||
                "Failed to add contact"
            );
        } finally {
            setAddingContact(false);
        }
    };

    // Start chat with a contact
    const handleStartChat = async (contact) => {
        if (!contact.user) return;

        try {
            const contactUserId =
                contact.user._id || contact.user;

            const conversation =
                await openConversation(contactUserId);

            if (conversation) {
                await selectConversation(conversation);
                setShowContacts(false);
            }
        } catch (error) {
            console.error("Start chat error:", error);
        }
    };

    // Get typing text for current conversation
    const getTypingText = () => {
        if (!selectedConversation) return null;

        const typing =
            typingUsers[selectedConversation._id];

        if (!typing) return null;

        return `${typing.userName} is typing...`;
    };

    // Format last seen
    const formatLastSeen = (date) => {
        if (!date) return "";

        const d = new Date(date);
        const now = new Date();
        const diff = now - d;

        if (diff < 60000) return "just now";
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000)
            return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });

        return d.toLocaleDateString();
    };

    return (
        <div
            style={{
                display: "flex",
                height: "100vh",
                fontFamily: "Arial, sans-serif",
            }}
        >
            {/* ================= LEFT SIDEBAR ================= */}
            <div
                style={{
                    width: "350px",
                    borderRight: "1px solid #ddd",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* User Header */}
                <div
                    style={{
                        padding: "15px",
                        borderBottom: "1px solid #ddd",
                    }}
                >
                    <h2>Chat App</h2>

                    <strong>{user?.name}</strong>

                    <p>{user?.phone}</p>

                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "8px",
                        }}
                    >
                        <button
                            onClick={() => {
                                setShowContacts(!showContacts);
                            }}
                            style={{
                                padding: "6px 12px",
                                cursor: "pointer",
                                backgroundColor:
                                    showContacts
                                        ? "#e0e0e0"
                                        : "#fff",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                            }}
                        >
                            {showContacts
                                ? "Show Chats"
                                : "Contacts"}
                        </button>

                        <button onClick={logout}
                            style={{
                                padding: "6px 12px",
                                cursor: "pointer",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Contacts / Chat List */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                    }}
                >
                    {showContacts ? (
                        <>
                            {/* ===== CONTACTS PANEL ===== */}
                            <div
                                style={{
                                    padding: "10px 15px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <h3 style={{ margin: 0 }}>
                                    Contacts
                                </h3>

                                <button
                                    onClick={() =>
                                        setShowContactForm(
                                            !showContactForm
                                        )
                                    }
                                    style={{
                                        padding: "4px 10px",
                                        cursor: "pointer",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        fontSize: "18px",
                                        backgroundColor: showContactForm
                                            ? "#e0e0e0"
                                            : "#fff",
                                    }}
                                >
                                    {showContactForm ? "✕" : "+"}
                                </button>
                            </div>

                            {/* Add Contact Form */}
                            {showContactForm && (
                                <form
                                    onSubmit={handleAddContact}
                                    style={{
                                        padding: "10px 15px",
                                        borderBottom: "1px solid #eee",
                                        backgroundColor: "#fafafa",
                                    }}
                                >
                                    <input
                                        type="text"
                                        value={contactPhone}
                                        onChange={(e) =>
                                            setContactPhone(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Phone number *"
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            marginBottom: "8px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            boxSizing: "border-box",
                                        }}
                                    />

                                    <input
                                        type="text"
                                        value={contactName}
                                        onChange={(e) =>
                                            setContactName(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Name (optional)"
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            marginBottom: "8px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            boxSizing: "border-box",
                                        }}
                                    />

                                    {contactError && (
                                        <p
                                            style={{
                                                color: "red",
                                                fontSize: "12px",
                                                margin: "0 0 8px",
                                            }}
                                        >
                                            {contactError}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={
                                            addingContact ||
                                            !contactPhone.trim()
                                        }
                                        style={{
                                            width: "100%",
                                            padding: "8px",
                                            cursor:
                                                addingContact
                                                    ? "not-allowed"
                                                    : "pointer",
                                            backgroundColor: "#4caf50",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "4px",
                                        }}
                                    >
                                        {addingContact
                                            ? "Adding..."
                                            : "Add Contact"}
                                    </button>
                                </form>
                            )}

                            {/* Contacts List */}
                            {contactsLoading && (
                                <p style={{ padding: "15px" }}>
                                    Loading contacts...
                                </p>
                            )}

                            {!contactsLoading &&
                                contacts.length === 0 && (
                                    <p style={{ padding: "15px" }}>
                                        No contacts yet
                                    </p>
                                )}

                            {!contactsLoading &&
                                contacts.map((contact) => (
                                    <div
                                        key={contact._id}
                                        onClick={() =>
                                            handleStartChat(contact)
                                        }
                                        style={{
                                            cursor: contact.registered
                                                ? "pointer"
                                                : "default",
                                            padding: "12px 15px",
                                            borderBottom:
                                                "1px solid #eee",
                                            opacity: contact.registered
                                                ? 1
                                                : 0.6,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <strong>
                                                {contact.name}
                                            </strong>

                                            {contact.registered ? (
                                                <span
                                                    style={{
                                                        fontSize: "10px",
                                                        color: "#4caf50",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    On ChatApp
                                                </span>
                                            ) : (
                                                <span
                                                    style={{
                                                        fontSize: "10px",
                                                        color: "#999",
                                                    }}
                                                >
                                                    Not registered
                                                </span>
                                            )}
                                        </div>

                                        <p
                                            style={{
                                                margin: "4px 0 0",
                                                fontSize: "13px",
                                                color: "#666",
                                            }}
                                        >
                                            {contact.phone}
                                        </p>
                                    </div>
                                ))}
                        </>
                    ) : (
                        <>
                            {/* ===== CHAT LIST ===== */}
                            <h3
                                style={{
                                    padding: "0 15px",
                                }}
                            >
                                Chats
                            </h3>

                            {loading && (
                                <p style={{ padding: "15px" }}>
                                    Loading chats...
                                </p>
                            )}

                            {!loading && conversations.length === 0 && (
                                <p style={{ padding: "15px" }}>
                                    No chats yet
                                </p>
                            )}

                            {!loading &&
                                conversations.map((conversation) => {
                                    const chatUser = conversation.user;

                                    if (!chatUser) return null;

                                    const isSelected =
                                        selectedConversation?._id ===
                                        conversation._id;

                                    const isTyping =
                                        typingUsers[conversation._id];

                                    // Unread/delivered status for last message
                                    const lastMsg =
                                        conversation.lastMessage;

                                    return (
                                        <div
                                            key={conversation._id}
                                            onClick={() =>
                                                selectConversation(
                                                    conversation
                                                )
                                            }
                                            style={{
                                                cursor: "pointer",
                                                padding: "12px 15px",
                                                borderBottom:
                                                    "1px solid #eee",
                                                backgroundColor:
                                                    isSelected
                                                        ? "#f0f0f0"
                                                        : "white",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <strong>
                                                    {chatUser.name}
                                                </strong>

                                                {/* Online indicator */}
                                                <span
                                                    style={{
                                                        display:
                                                            "inline-block",
                                                        width: "8px",
                                                        height: "8px",
                                                        borderRadius:
                                                            "50%",
                                                        backgroundColor:
                                                            chatUser.isOnline
                                                                ? "#4caf50"
                                                                : "#ccc",
                                                    }}
                                                    title={
                                                        chatUser.isOnline
                                                            ? "Online"
                                                            : `Last seen ${formatLastSeen(chatUser.lastSeen)}`
                                                    }
                                                ></span>
                                            </div>

                                            <p
                                                style={{
                                                    margin: "5px 0",
                                                    fontSize: "14px",
                                                    color: "#666",
                                                }}
                                            >
                                                {chatUser.phone}
                                            </p>

                                            {isTyping ? (
                                                <p
                                                    style={{
                                                        margin: "5px 0 0",
                                                        fontSize: "13px",
                                                        color: "#4caf50",
                                                        fontStyle: "italic",
                                                    }}
                                                >
                                                    typing...
                                                </p>
                                            ) : (
                                                lastMsg && (
                                                    <p
                                                        style={{
                                                            margin: "5px 0 0",
                                                            fontSize: "14px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        {/* Show tick for sent messages */}
                                                        {lastMsg.sender === user?._id && (
                                                            <MessageStatus
                                                                message={lastMsg}
                                                                isMyMessage={true}
                                                            />
                                                        )}
                                                        <span
                                                            style={{
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            {lastMsg.text}
                                                        </span>
                                                    </p>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                        </>
                    )}
                </div>
            </div>

            {/* ================= CHAT WINDOW ================= */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div
                            style={{
                                padding: "15px",
                                borderBottom: "1px solid #ddd",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                }}
                            >
                                {/* Online dot */}
                                <span
                                    style={{
                                        display: "inline-block",
                                        width: "10px",
                                        height: "10px",
                                        borderRadius: "50%",
                                        backgroundColor:
                                            selectedConversation.user
                                                ?.isOnline
                                                ? "#4caf50"
                                                : "#ccc",
                                        flexShrink: 0,
                                    }}
                                ></span>

                                <div>
                                    <h2 style={{ margin: 0 }}>
                                        {selectedConversation.user?.name}
                                    </h2>

                                    <p
                                        style={{
                                            margin: "2px 0 0",
                                            color: "#666",
                                            fontSize: "13px",
                                        }}
                                    >
                                        {selectedConversation.user
                                            ?.isOnline
                                            ? "online"
                                            : `last seen ${formatLastSeen(selectedConversation.user?.lastSeen)}`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Typing Indicator */}
                        {getTypingText() && (
                            <div
                                style={{
                                    padding: "4px 20px",
                                    fontSize: "13px",
                                    color: "#4caf50",
                                    fontStyle: "italic",
                                    backgroundColor: "#f9f9f9",
                                }}
                            >
                                {getTypingText()}
                            </div>
                        )}

                        {/* Messages */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: "auto",
                                padding: "20px",
                            }}
                        >
                            {messagesLoading && (
                                <p>Loading messages...</p>
                            )}

                            {!messagesLoading &&
                                messages.length === 0 && (
                                    <p>
                                        No messages yet. Start the conversation.
                                    </p>
                                )}

                            {messages.map((message) => {
                                const isMyMessage =
                                    message.sender?._id === user?._id;

                                return (
                                    <div
                                        key={message._id}
                                        style={{
                                            display: "flex",
                                            justifyContent: isMyMessage
                                                ? "flex-end"
                                                : "flex-start",
                                            marginBottom: "10px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                maxWidth: "60%",
                                                padding: "10px 14px",
                                                borderRadius: "10px",
                                                backgroundColor: isMyMessage
                                                    ? "#dcf8c6"
                                                    : "#f1f1f1",
                                            }}
                                        >
                                            {!isMyMessage && (
                                                <p
                                                    style={{
                                                        margin: "0 0 5px",
                                                        fontSize: "12px",
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {message.sender?.name}
                                                </p>
                                            )}

                                            <p
                                                style={{
                                                    margin: 0,
                                                    wordBreak: "break-word",
                                                }}
                                            >
                                                {message.text}
                                            </p>

                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "flex-end",
                                                    alignItems: "center",
                                                    marginTop: "4px",
                                                }}
                                            >
                                                <small
                                                    style={{
                                                        fontSize: "10px",
                                                        color: "#777",
                                                    }}
                                                >
                                                    {message.createdAt
                                                        ? new Date(
                                                            message.createdAt
                                                        ).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                        : ""}
                                                </small>

                                                {/* Message Status Ticks */}
                                                <MessageStatus
                                                    message={message}
                                                    isMyMessage={isMyMessage}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <form
                            onSubmit={handleSendMessage}
                            style={{
                                display: "flex",
                                padding: "15px",
                                borderTop: "1px solid #ddd",
                                gap: "10px",
                            }}
                        >
                            <input
                                type="text"
                                value={messageText}
                                onChange={handleInputChange}
                                onBlur={() => stopTyping()}
                                placeholder="Type a message..."
                                disabled={sending}
                                style={{
                                    flex: 1,
                                    padding: "12px",
                                    border: "1px solid #ccc",
                                    borderRadius: "5px",
                                    outline: "none",
                                }}
                            />

                            <button
                                type="submit"
                                disabled={
                                    sending || !messageText.trim()
                                }
                                style={{
                                    padding: "12px 20px",
                                    cursor:
                                        sending || !messageText.trim()
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                {sending ? "Sending..." : "Send"}
                            </button>
                        </form>
                    </>
                ) : (
                    /* No Chat Selected */
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <h2>Select a chat to start messaging</h2>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatHome;