import React, { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import MessageBubble from "./MessageBubble";

export const MessageList = ({
    messages,
    messagesLoading,
    typingText,
    searchTerm = "",
    onOpenVerifyEncryption,
    onForward,
}) => {
    const { user } = useContext(AuthContext);
    const {
        reactToMessage,
        deleteMessage,
        setReplyingTo,
        toggleStarMessage,
        togglePinMessage,
        selectedConversation,
    } = useContext(ChatContext);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom on new message if not searching
    useEffect(() => {
        if (!searchTerm) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, typingText, searchTerm]);

    // Format date headers (e.g. Today, Yesterday, Date)
    const getDateHeader = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return "Today";
        }
        if (d.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }
        return d.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
        });
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-1">
            {messagesLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    Loading messages...
                </div>
            ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-7 h-7"
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
                        <h4 className="text-sm font-semibold text-zinc-200">
                            No messages yet
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">
                            Say hello to break the ice! 👋
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* End-to-End Encryption Notice Banner */}
                    <div className="flex justify-center my-3 select-none px-4">
                        <div
                            onClick={onOpenVerifyEncryption}
                            className="cursor-pointer group flex items-center gap-2 max-w-md px-3.5 py-2 rounded-2xl bg-[#161628]/90 hover:bg-[#1d1d36] border border-amber-500/20 hover:border-amber-500/40 text-center text-[11px] text-amber-200/90 shadow-sm transition-all"
                            title="Click to verify security code"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                            <span className="leading-snug">
                                Messages and calls are end-to-end encrypted. No one outside of this chat can read them. Click to verify.
                            </span>
                        </div>
                    </div>

                    {messages.map((message, index) => {
                    const isMyMessage = message.sender?._id === user?._id;
                    const prevMessage = messages[index - 1];

                    // Check if date changed
                    const currentDate = new Date(message.createdAt).toDateString();
                    const prevDate = prevMessage
                        ? new Date(prevMessage.createdAt).toDateString()
                        : null;
                    const showDateHeader = currentDate !== prevDate;

                    return (
                        <React.Fragment key={message._id || index}>
                            {showDateHeader && (
                                <div className="flex items-center justify-center my-4 select-none">
                                    <span className="px-3 py-1 rounded-full bg-[#16162a] border border-white/5 text-[11px] font-medium text-zinc-400 shadow-sm">
                                        {getDateHeader(message.createdAt)}
                                    </span>
                                </div>
                            )}

                            {(() => {
                                const isPinned = Boolean(
                                    selectedConversation?.pinnedMessages?.some(
                                        (pm) => (pm?._id || pm)?.toString() === message._id?.toString()
                                    )
                                );
                                return (
                                    <MessageBubble
                                        message={message}
                                        isMyMessage={isMyMessage}
                                        isGroup={Boolean(selectedConversation?.isGroup)}
                                        currentUserId={user?._id}
                                        onReply={setReplyingTo}
                                        onForward={onForward}
                                        onReact={reactToMessage}
                                        onDelete={deleteMessage}
                                        onToggleStar={toggleStarMessage}
                                        onTogglePin={togglePinMessage}
                                        isPinned={isPinned}
                                        searchHighlight={searchTerm}
                                    />
                                );
                            })()}
                        </React.Fragment>
                    );
                })}
                </>
            )}

            {/* Typing Indicator */}
            {typingText && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#16162a] border border-white/5 text-xs text-purple-300 w-fit">
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" />
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                        />
                        <span
                            className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                        />
                    </div>
                    <span className="text-[11px] text-zinc-400">{typingText}</span>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;
