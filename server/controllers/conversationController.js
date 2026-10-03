import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

// Helper to format a conversation for clients
const formatConversationForClient = (conversation, currentUserId) => {
    const isPinned = Boolean(
        conversation.pinnedBy &&
        conversation.pinnedBy.some(
            (id) => (id?._id || id)?.toString() === currentUserId.toString()
        )
    );
    const pinnedMessages = conversation.pinnedMessages || [];

    if (conversation.isGroup) {
        return {
            _id: conversation._id,
            isGroup: true,
            isPinned,
            pinnedMessages,
            groupName: conversation.groupName || "Unnamed Group",
            groupAvatar: conversation.groupAvatar || "",
            groupDescription: conversation.groupDescription || "",
            groupAdmin: conversation.groupAdmin || null,
            groupAdmins: conversation.groupAdmins || [],
            groupSettings: conversation.groupSettings || {
                onlyAdminsCanEditInfo: false,
                onlyAdminsCanSendMessages: false,
                onlyAdminsCanAddMembers: false,
            },
            participants: conversation.participants || [],
            user: {
                _id: conversation._id,
                name: conversation.groupName || "Unnamed Group",
                profilePicture: conversation.groupAvatar || "",
                isGroup: true,
                participantsCount: conversation.participants?.length || 0,
                participants: conversation.participants || [],
                groupAdmin: conversation.groupAdmin || null,
                groupAdmins: conversation.groupAdmins || [],
                groupSettings: conversation.groupSettings || {
                    onlyAdminsCanEditInfo: false,
                    onlyAdminsCanSendMessages: false,
                    onlyAdminsCanAddMembers: false,
                },
                groupDescription: conversation.groupDescription || "",
            },
            lastMessage: conversation.lastMessage || null,
            lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
            createdAt: conversation.createdAt,
        };
    } else {
        const otherUser = conversation.participants.find(
            (participant) =>
                participant._id?.toString() !== currentUserId.toString()
        );

        return {
            _id: conversation._id,
            isGroup: false,
            isPinned,
            pinnedMessages,
            participants: conversation.participants,
            user: otherUser || null,
            lastMessage: conversation.lastMessage || null,
            lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
            createdAt: conversation.createdAt,
        };
    }
};

// Get all conversations of logged-in user (both 1-on-1 and Groups)
const getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
        })
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate(
                "groupAdmin",
                "name phone profilePicture"
            )
            .populate(
                "groupAdmins",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate(
                "lastMessage",
                "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
            )
            .populate({
                path: "pinnedMessages",
                populate: {
                    path: "sender",
                    select: "name profilePicture",
                },
            })
            .sort({
                lastMessageAt: -1,
                updatedAt: -1,
            });

        const result = conversations.map((conv) =>
            formatConversationForClient(conv, req.user._id)
        );

        // Sort pinned chats to top
        result.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt);
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
            isGroup: { $ne: true },
            participants: {
                $all: [req.user._id, userId],
                $size: 2,
            },
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user._id, userId],
                isGroup: false,
            });
        }

        conversation = await conversation.populate(
            "participants",
            "name phone profilePicture isOnline lastSeen"
        );
        conversation = await conversation.populate(
            "lastMessage",
            "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
        );

        const formattedConversation = formatConversationForClient(
            conversation,
            req.user._id
        );

        res.status(200).json({
            success: true,
            error: false,
            conversation: formattedConversation,
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

// Create a new Group conversation
const createGroupConversation = async (req, res) => {
    try {
        const {
            groupName,
            participants = [],
            groupAvatar = "",
            groupDescription = "",
        } = req.body;

        if (!groupName || !groupName.trim()) {
            return res.status(400).json({
                success: false,
                message: "Group name is required",
            });
        }

        // Add creator and ensure uniqueness
        const participantSet = new Set(participants.map(String));
        participantSet.add(req.user._id.toString());
        const allParticipants = Array.from(participantSet);

        if (allParticipants.length < 2) {
            return res.status(400).json({
                success: false,
                message: "A group must have at least 2 members",
            });
        }

        const conversation = await Conversation.create({
            isGroup: true,
            groupName: groupName.trim(),
            groupAvatar: groupAvatar || "",
            groupDescription: groupDescription ? groupDescription.trim() : "",
            participants: allParticipants,
            groupAdmin: req.user._id,
            groupAdmins: [req.user._id],
            lastMessageAt: new Date(),
        });

        const populated = await Conversation.findById(conversation._id)
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate("groupAdmin", "name phone profilePicture")
            .populate("groupAdmins", "name phone profilePicture isOnline lastSeen");

        const formatted = formatConversationForClient(populated, req.user._id);

        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:created", formatted);
            });
        }

        res.status(201).json({
            success: true,
            conversation: formatted,
        });
    } catch (error) {
        console.error("Create group error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create group",
        });
    }
};

// Update group info (Name, Avatar, Description)
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { groupName, groupAvatar, groupDescription } = req.body;

        const conversation = await Conversation.findById(id);

        if (!conversation || !conversation.isGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        const userId = req.user._id.toString();
        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);

        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can update group information",
            });
        }

        if (groupName && groupName.trim()) {
            conversation.groupName = groupName.trim();
        }
        if (groupAvatar !== undefined) {
            conversation.groupAvatar = groupAvatar;
        }
        if (groupDescription !== undefined) {
            conversation.groupDescription = groupDescription.trim();
        }

        await conversation.save();

        const populated = await Conversation.findById(id)
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate("groupAdmin", "name phone profilePicture")
            .populate("groupAdmins", "name phone profilePicture isOnline lastSeen")
            .populate(
                "lastMessage",
                "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
            );

        const formatted = formatConversationForClient(populated, req.user._id);

        // Realtime broadcast to all group members
        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:updated", formatted);
            });
        }

        res.status(200).json({
            success: true,
            conversation: formatted,
        });
    } catch (error) {
        console.error("Update group error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update group",
        });
    }
};

// Add members to group
const addGroupMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const { members = [] } = req.body; // array of user IDs

        if (!members || members.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select members to add",
            });
        }

        const conversation = await Conversation.findById(id);

        if (!conversation || !conversation.isGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        const userId = req.user._id.toString();
        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);

        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can add members",
            });
        }

        const currentSet = new Set(
            conversation.participants.map((p) => (p?._id || p).toString())
        );

        members.forEach((mId) => currentSet.add(mId.toString()));
        conversation.participants = Array.from(currentSet);

        await conversation.save();

        const populated = await Conversation.findById(id)
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate("groupAdmin", "name phone profilePicture")
            .populate("groupAdmins", "name phone profilePicture isOnline lastSeen")
            .populate(
                "lastMessage",
                "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
            );

        const formatted = formatConversationForClient(populated, req.user._id);

        // Realtime broadcast to all group members
        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:updated", formatted);
            });
        }

        res.status(200).json({
            success: true,
            conversation: formatted,
        });
    } catch (error) {
        console.error("Add members error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add group members",
        });
    }
};

// Remove member or leave group
const removeGroupMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;

        const conversation = await Conversation.findById(id);

        if (!conversation || !conversation.isGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        const userId = req.user._id.toString();
        const targetId = memberId.toString();

        const isSelfLeaving = userId === targetId;
        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);
        const isAdmin = isOwner || isCoAdmin;

        if (!isSelfLeaving && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can remove other members",
            });
        }

        // Cannot remove group creator / owner unless creator is leaving themselves
        if (!isSelfLeaving && conversation.groupAdmin?.toString() === targetId) {
            return res.status(403).json({
                success: false,
                message: "Cannot remove the group owner",
            });
        }

        conversation.participants = conversation.participants.filter(
            (p) => (p?._id || p).toString() !== targetId
        );

        if (conversation.groupAdmins) {
            conversation.groupAdmins = conversation.groupAdmins.filter(
                (a) => (a?._id || a).toString() !== targetId
            );
        }

        // If the primary admin leaves, assign new admin to first remaining admin or participant
        if (
            conversation.groupAdmin?.toString() === targetId &&
            conversation.participants.length > 0
        ) {
            const nextAdmin =
                conversation.groupAdmins && conversation.groupAdmins.length > 0
                    ? conversation.groupAdmins[0]
                    : conversation.participants[0];
            conversation.groupAdmin = nextAdmin;
            if (
                !conversation.groupAdmins.some(
                    (a) => (a?._id || a).toString() === (nextAdmin?._id || nextAdmin).toString()
                )
            ) {
                conversation.groupAdmins.push(nextAdmin);
            }
        }

        await conversation.save();

        const populated = await Conversation.findById(id)
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate("groupAdmin", "name phone profilePicture")
            .populate("groupAdmins", "name phone profilePicture isOnline lastSeen")
            .populate(
                "lastMessage",
                "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
            );

        const formatted = formatConversationForClient(populated, req.user._id);

        const io = req.app.get("io");
        if (io) {
            // Notify the member who left or was removed
            io.to(`user:${targetId}`).emit("group:removed", {
                conversationId: id,
                removedBy: req.user._id,
            });
            // Broadcast updated group to remaining participants
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:updated", formatted);
            });
        }

        res.status(200).json({
            success: true,
            conversation: formatted,
            removedMemberId: targetId,
        });
    } catch (error) {
        console.error("Remove group member error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove member",
        });
    }
};

// Promote or demote group admin
const toggleGroupAdmin = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const userId = req.user._id.toString();
        const targetId = memberId.toString();

        const conversation = await Conversation.findById(id);

        if (!conversation || !conversation.isGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);

        if (!isOwner && !isCoAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can manage roles",
            });
        }

        // Verify target is an active participant
        const isParticipant = conversation.participants.some(
            (p) => (p?._id || p).toString() === targetId
        );

        if (!isParticipant) {
            return res.status(400).json({
                success: false,
                message: "User is not a member of this group",
            });
        }

        // Cannot change role of the primary group owner
        if (conversation.groupAdmin?.toString() === targetId) {
            return res.status(400).json({
                success: false,
                message: "Cannot modify role of the group owner",
            });
        }

        conversation.groupAdmins = conversation.groupAdmins || [];
        const adminIndex = conversation.groupAdmins.findIndex(
            (a) => (a?._id || a).toString() === targetId
        );

        let isNowAdmin = false;
        if (adminIndex > -1) {
            // Demote to member
            conversation.groupAdmins.splice(adminIndex, 1);
            isNowAdmin = false;
        } else {
            // Promote to admin
            conversation.groupAdmins.push(targetId);
            isNowAdmin = true;
        }

        await conversation.save();

        const populated = await Conversation.findById(id)
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen"
            )
            .populate("groupAdmin", "name phone profilePicture")
            .populate("groupAdmins", "name phone profilePicture isOnline lastSeen")
            .populate(
                "lastMessage",
                "sender receiver text messageType fileUrl fileName fileSize duration isDelivered isSeen isDeleted deletedForEveryone createdAt"
            );

        const formatted = formatConversationForClient(populated, req.user._id);

        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:updated", formatted);
            });
        }

        res.status(200).json({
            success: true,
            conversation: formatted,
            isAdmin: isNowAdmin,
            message: isNowAdmin ? "Promoted to Group Admin" : "Demoted to Member",
        });
    } catch (error) {
        console.error("Toggle group admin error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update member role",
        });
    }
};

// Toggle Pin Conversation (Favorite chat pinned to sidebar top)
const togglePinConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        if (!conversation.pinnedBy) {
            conversation.pinnedBy = [];
        }

        const index = conversation.pinnedBy.findIndex(
            (id) => (id?._id || id).toString() === userId.toString()
        );

        let isPinned = false;
        if (index > -1) {
            conversation.pinnedBy.splice(index, 1);
            isPinned = false;
        } else {
            conversation.pinnedBy.push(userId);
            isPinned = true;
        }

        await conversation.save();

        res.status(200).json({
            success: true,
            isPinned,
            conversationId: conversation._id,
            message: isPinned ? "Chat pinned to top" : "Chat unpinned",
        });
    } catch (error) {
        console.error("Toggle pin conversation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle pin conversation",
        });
    }
};

// Toggle Pin Message (Important message pinned inside chat)
const togglePinMessage = async (req, res) => {
    try {
        const { conversationId, messageId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        if (!conversation.pinnedMessages) {
            conversation.pinnedMessages = [];
        }

        const index = conversation.pinnedMessages.findIndex(
            (id) => (id?._id || id).toString() === messageId.toString()
        );

        let isPinned = false;
        if (index > -1) {
            conversation.pinnedMessages.splice(index, 1);
            isPinned = false;
        } else {
            conversation.pinnedMessages.push(messageId);
            isPinned = true;
        }

        await conversation.save();

        const updatedConv = await Conversation.findById(conversationId).populate({
            path: "pinnedMessages",
            populate: {
                path: "sender",
                select: "name profilePicture",
            },
        });

        // Notify socket participants in realtime
        const io = req.app.get("io");
        if (io && conversation.participants) {
            conversation.participants.forEach((pId) => {
                io.to(`user:${pId.toString()}`).emit("conversation:pinnedMessagesUpdated", {
                    conversationId,
                    pinnedMessages: updatedConv.pinnedMessages || [],
                    messageId,
                    isPinned,
                    pinnedBy: userId,
                });
            });
        }

        res.status(200).json({
            success: true,
            isPinned,
            pinnedMessages: updatedConv.pinnedMessages || [],
            message: isPinned ? "Message pinned" : "Message unpinned",
        });
    } catch (error) {
        console.error("Toggle pin message error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle pin message",
        });
    }
};

export {
    getMyConversations,
    getOrCreateConversation,
    createGroupConversation,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    togglePinConversation,
    togglePinMessage,
    toggleGroupAdmin,
};