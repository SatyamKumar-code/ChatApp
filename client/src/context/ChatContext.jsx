import {
    createContext,
    useContext,
    useEffect,
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

    const [messages, setMessages] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messagesLoading, setMessagesLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            if (socket.connected) {
                socket.disconnect();
            }

            return;
        }

        socket.connect();

        socket.on("connect", () => {
            console.log(
                "Socket connected:",
                socket.id
            );
        });

        socket.on("socket:connected", (data) => {
            console.log(
                "Socket authenticated:",
                data
            );
        });

        socket.on("connect_error", (error) => {
            console.error(
                "Socket connection error:",
                error.message
            );
        });

        socket.on("disconnect", (reason) => {
            console.log(
                "Socket disconnected:",
                reason
            );
        });

        return () => {
            socket.off("connect");
            socket.off("socket:connected");
            socket.off("connect_error");
            socket.off("disconnect");

            socket.disconnect();
        };
    }, [user]);

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
        if (
            !selectedConversation ||
            !text.trim()
        ) {
            return;
        }

        try {
            const response = await api.post(
                "/messages",
                {
                    conversationId:
                        selectedConversation._id,

                    text: text.trim(),
                }
            );

            if (response.data.success) {
                setMessages((prev) => [
                    ...prev,
                    response.data.message,
                ]);

                await getConversations();
            }

            return response.data;
        } catch (error) {
            console.error(
                "Send message error:",
                error
            );

            throw error;
        }
    };

    const selectConversation = async (conversation) => {
        setSelectedConversation(conversation);

        await getMessages(conversation._id);
    };

    useEffect(() => {
        if (user) {
            getConversations();
        } else {
            setConversations([]);
            setLoading(false);
        }
    }, [user]);


    const value = {
        conversations,
        loading,

        messages,
        messagesLoading,
        selectedConversation,

        getConversations,
        openConversation,
        getMessages,
        selectConversation,
        sendMessage,
    };


    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};




export default ChatProvider;