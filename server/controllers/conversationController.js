import Conversation from "../models/Conversation.js";
import User from "../models/User.js";


// Get all conversations of logged-in user
const getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
        })
            .populate(
                "participants",
                "name phone profilePic isOnline lastSeen"
            )
            .populate(
                "lastMessage",
                "sender receiver text messageType isDelivered isSeen createdAt"
            )
            .sort({
                lastMessageAt: -1,
                updatedAt: -1,
            });

        const result = conversations.map((conversation) => {
            const otherUser = conversation.participants.find(
                (participant) =>
                    participant._id.toString() !== req.user._id.toString()
            );

            return {
                _id: conversation._id,

                user: otherUser || null,

                lastMessage: conversation.lastMessage || null,

                lastMessageAt: conversation.lastMessageAt,

                createdAt: conversation.createdAt,
            };
        });

        res.status(200).json({
            success: true,
            error: false,
            conversations: result,
        });
    } catch (error) {
        console.error("Get conversations error:", error);

        res.status(500).json({
            success: false,
            error: true,
            message: "Failed to get conversations",
        });
    }
};


// Get or create one-to-one conversation
const getOrCreateConversation = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }

        if (userId.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot chat with yourself",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        let conversation = await Conversation.findOne({
            participants: {
                $all: [req.user._id, userId],
            },
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user._id, userId],
            });
        }

        conversation = await conversation.populate(
            "participants",
            "name phone profilePic isOnline lastSeen"
        );

        res.status(200).json({
            success: true,
            error: false,
            conversation,
        });
    } catch (error) {
        console.error("Conversation error:", error);

        res.status(500).json({
            success: false,
            error: true,
            message: "Failed to create conversation",
        });
    }
};


export { getMyConversations, getOrCreateConversation };