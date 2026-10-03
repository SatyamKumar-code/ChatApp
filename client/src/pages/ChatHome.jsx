import { useContext, useState } from "react";

import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

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
    } = useContext(ChatContext);

    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);

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

                    <button onClick={logout}>
                        Logout
                    </button>
                </div>

                {/* Chat List */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                    }}
                >
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

                            return (
                                <div
                                    key={conversation._id}
                                    onClick={() =>
                                        selectConversation(conversation)
                                    }
                                    style={{
                                        cursor: "pointer",
                                        padding: "12px 15px",
                                        borderBottom: "1px solid #eee",
                                        backgroundColor: isSelected
                                            ? "#f0f0f0"
                                            : "white",
                                    }}
                                >
                                    <strong>
                                        {chatUser.name}
                                    </strong>

                                    <p
                                        style={{
                                            margin: "5px 0",
                                            fontSize: "14px",
                                            color: "#666",
                                        }}
                                    >
                                        {chatUser.phone}
                                    </p>

                                    {conversation.lastMessage && (
                                        <p
                                            style={{
                                                margin: "5px 0 0",
                                                fontSize: "14px",
                                            }}
                                        >
                                            {conversation.lastMessage.text}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
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
                            <h2 style={{ margin: 0 }}>
                                {selectedConversation.user?.name}
                            </h2>

                            <p
                                style={{
                                    margin: "5px 0 0",
                                    color: "#666",
                                }}
                            >
                                {selectedConversation.user?.phone}
                            </p>
                        </div>

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

                                            <small
                                                style={{
                                                    display: "block",
                                                    marginTop: "5px",
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
                                        </div>
                                    </div>
                                );
                            })}
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
                                onChange={(e) =>
                                    setMessageText(e.target.value)
                                }
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