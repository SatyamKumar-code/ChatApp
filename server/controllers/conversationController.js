import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import mongoose from "mongoose";
import { isUserOnline } from "../socket/socketServer.js";

// Helper to create and broadcast system audit messages in group chats
const createAndBroadcastSystemMessage = async (conversationId, senderId, text, io, participants) => {
    try {
        const sysMsg = await Message.create({
            conversation: conversationId,
            sender: senderId,
            text,
            messageType: "system",
        });

        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: sysMsg._id,
            lastMessageAt: new Date(),
        });

        const populatedSysMsg = await Message.findById(sysMsg._id)
            .populate("sender", "name phone profilePicture isOnline");

        if (io && participants) {
            participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("newMessage", populatedSysMsg);
            });
        }

        return populatedSysMsg;
    } catch (err) {
        console.error("Create system message error:", err);
        return null;
    }
};

// Helper to format a conversation for clients
const formatConversationForClient = (conversation, currentUserId, sentMessagesCount = 0, unreadCount = 0) => {
    const isPinned = Boolean(
        conversation.pinnedBy &&
        conversation.pinnedBy.some(
            (id) => (id?._id || id)?.toString() === currentUserId.toString()
        )
    );
    let pinnedMessages = conversation.pinnedMessages || [];

    if (conversation.isGroup) {
        const isParticipant = conversation.participants.some(
            (p) => (p?._id || p)?.toString() === currentUserId.toString()
        );
        const isLeft = !isParticipant;

        let clientLastMessage = conversation.lastMessage || null;
        const userJoinedEntry = conversation.participantJoinedAt?.find(
            (p) => (p.user?._id || p.user)?.toString() === currentUserId.toString()
        );

        if (userJoinedEntry) {
            const joinTime = userJoinedEntry.joinedAt ? new Date(userJoinedEntry.joinedAt).getTime() : 0;
            const leaveTime = userJoinedEntry.leftAt ? new Date(userJoinedEntry.leftAt).getTime() : Infinity;

            if (clientLastMessage && clientLastMessage.createdAt) {
                const msgTime = new Date(clientLastMessage.createdAt).getTime();
                if (msgTime < joinTime || msgTime > leaveTime) {
                    clientLastMessage = null;
                }
            }
            if (pinnedMessages.length > 0) {
                pinnedMessages = pinnedMessages.filter((pm) => {
                    if (!pm.createdAt) return true;
                    const pmTime = new Date(pm.createdAt).getTime();
                    return pmTime >= joinTime && pmTime <= leaveTime;
                });
            }
        }

        return {
            _id: conversation._id,
            isGroup: true,
            isPinned,
            isLeft,
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
            participantJoinedAt: conversation.participantJoinedAt || [],
            user: {
                _id: conversation._id,
                name: conversation.groupName || "Unnamed Group",
                profilePicture: conversation.groupAvatar || "",
                isGroup: true,
                isLeft,
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
            lastMessage: clientLastMessage,
            lastMessageAt: clientLastMessage
                ? (clientLastMessage.createdAt || conversation.lastMessageAt || conversation.updatedAt)
                : (userJoinedEntry?.leftAt || userJoinedEntry?.joinedAt || conversation.createdAt),
            createdAt: conversation.createdAt,
            unreadCount: unreadCount || 0,
        };
    } else {
        const otherUser = conversation.participants.find(
            (participant) =>
                participant._id?.toString() !== currentUserId.toString()
        );

        let userObj = null;
        if (otherUser) {
            const isBlockedByOther = Boolean(
                otherUser.blockedUsers &&
                otherUser.blockedUsers.some(
                    (bId) => (bId?._id || bId).toString() === currentUserId.toString()
                )
            );

            const activeOnline = !isBlockedByOther && isUserOnline(otherUser._id);
            userObj = {
                _id: otherUser._id,
                name: otherUser.name,
                phone: otherUser.phone,
                profilePicture: isBlockedByOther ? "" : (otherUser.profilePicture || ""),
                about: isBlockedByOther ? "" : (otherUser.about || ""),
                isOnline: Boolean(activeOnline),
                lastSeen: isBlockedByOther ? null : otherUser.lastSeen,
                isBlockedByOther,
            };
        }

        return {
            _id: conversation._id,
            isGroup: false,
            isPinned,
            pinnedMessages,
            participants: conversation.participants,
            user: userObj,
            lastMessage: conversation.lastMessage || null,
            lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
            createdAt: conversation.createdAt,
            sentMessagesCount: sentMessagesCount || 0,
            unreadCount: unreadCount || 0,
        };
    }
};

// Get all conversations of logged-in user (both 1-on-1 and Groups)
const getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            $or: [
                { participants: req.user._id },
                { pastParticipants: req.user._id },
                { "participantJoinedAt.user": req.user._id },
            ],
            hiddenFor: { $ne: req.user._id },
        })
            .populate(
                "participants",
                "name phone profilePicture isOnline lastSeen blockedUsers"
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

        // Compute unread messages count for each conversation
        const allConvIds = conversations.map((c) => c._id);
        const unreadCountMap = {};

        if (allConvIds.length > 0) {
            const currentObjectId = new mongoose.Types.ObjectId(req.user._id.toString());
            const counts = await Message.aggregate([
                {
                    $match: {
                        conversation: { $in: allConvIds },
                        sender: { $ne: currentObjectId },
                        isSeen: false,
                        deletedFor: { $nin: [currentObjectId] },
                        messageType: { $ne: "system" },
                    },
                },
                {
                    $group: {
                        _id: "$conversation",
                        count: { $sum: 1 },
                    },
                },
            ]);

            counts.forEach((c) => {
                unreadCountMap[c._id.toString()] = c.count;
            });
        }

        const result = conversations.map((conv) =>
            formatConversationForClient(
                conv,
                req.user._id,
                0,
                unreadCountMap[conv._id.toString()] || 0
            )
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
            "name phone profilePicture isOnline lastSeen blockedUsers"
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

        const joinDate = new Date();
        const participantJoinedAt = allParticipants.map((pId) => ({
            user: pId,
            joinedAt: joinDate,
        }));

        const conversation = await Conversation.create({
            isGroup: true,
            groupName: groupName.trim(),
            groupAvatar: groupAvatar || "",
            groupDescription: groupDescription ? groupDescription.trim() : "",
            participants: allParticipants,
            participantJoinedAt,
            groupAdmin: req.user._id,
            groupAdmins: [req.user._id],
            lastMessageAt: joinDate,
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
                const memberFormatted = formatConversationForClient(populated, pId);
                io.to(`user:${pId}`).emit("group:created", memberFormatted);
            });
        }

        // Create initial system message for group creation
        await createAndBroadcastSystemMessage(
            conversation._id,
            req.user._id,
            `${req.user.name} created group "${groupName.trim()}"`,
            io,
            populated.participants
        );

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

// Update group info (Name, Avatar, Description) or Group Settings (Permissions)
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { groupName, groupAvatar, groupDescription, groupSettings } = req.body;

        const conversation = await Conversation.findById(id);

        if (!conversation || !conversation.isGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found",
            });
        }

        const userId = req.user._id.toString();
        const isParticipant = conversation.participants.some(
            (p) => (p?._id || p).toString() === userId
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: "You are not a participant of this group",
            });
        }

        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);
        const isAdmin = isOwner || isCoAdmin;

        const oldName = conversation.groupName;
        const oldAvatar = conversation.groupAvatar;
        const oldDescription = conversation.groupDescription;
        const oldSettings = { ...(conversation.groupSettings?.toObject ? conversation.groupSettings.toObject() : conversation.groupSettings) };

        const changes = [];

        // If updating groupSettings (permissions), ONLY admins are allowed
        if (groupSettings !== undefined) {
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "Only group admins can change group settings",
                });
            }

            if (groupSettings.onlyAdminsCanEditInfo !== undefined && Boolean(groupSettings.onlyAdminsCanEditInfo) !== Boolean(oldSettings.onlyAdminsCanEditInfo)) {
                changes.push(
                    groupSettings.onlyAdminsCanEditInfo
                        ? `${req.user.name} changed group settings to allow only admins to edit group info`
                        : `${req.user.name} changed group settings to allow all members to edit group info`
                );
            }
            if (groupSettings.onlyAdminsCanSendMessages !== undefined && Boolean(groupSettings.onlyAdminsCanSendMessages) !== Boolean(oldSettings.onlyAdminsCanSendMessages)) {
                changes.push(
                    groupSettings.onlyAdminsCanSendMessages
                        ? `${req.user.name} changed group settings to allow only admins to send messages`
                        : `${req.user.name} changed group settings to allow all members to send messages`
                );
            }
            if (groupSettings.onlyAdminsCanAddMembers !== undefined && Boolean(groupSettings.onlyAdminsCanAddMembers) !== Boolean(oldSettings.onlyAdminsCanAddMembers)) {
                changes.push(
                    groupSettings.onlyAdminsCanAddMembers
                        ? `${req.user.name} changed group settings to allow only admins to add members`
                        : `${req.user.name} changed group settings to allow all members to add members`
                );
            }

            conversation.groupSettings = {
                onlyAdminsCanEditInfo: Boolean(
                    groupSettings.onlyAdminsCanEditInfo !== undefined
                        ? groupSettings.onlyAdminsCanEditInfo
                        : conversation.groupSettings?.onlyAdminsCanEditInfo
                ),
                onlyAdminsCanSendMessages: Boolean(
                    groupSettings.onlyAdminsCanSendMessages !== undefined
                        ? groupSettings.onlyAdminsCanSendMessages
                        : conversation.groupSettings?.onlyAdminsCanSendMessages
                ),
                onlyAdminsCanAddMembers: Boolean(
                    groupSettings.onlyAdminsCanAddMembers !== undefined
                        ? groupSettings.onlyAdminsCanAddMembers
                        : conversation.groupSettings?.onlyAdminsCanAddMembers
                ),
            };
        }

        // If updating group name, avatar, or description:
        const hasInfoUpdates =
            groupName !== undefined ||
            groupAvatar !== undefined ||
            groupDescription !== undefined;

        if (hasInfoUpdates) {
            const onlyAdminsCanEdit = conversation.groupSettings?.onlyAdminsCanEditInfo ?? false;
            if (!isAdmin && onlyAdminsCanEdit) {
                return res.status(403).json({
                    success: false,
                    message: "Only group admins can update group information",
                });
            }

            if (groupName !== undefined && groupName.trim() && groupName.trim() !== oldName) {
                conversation.groupName = groupName.trim();
                changes.push(`${req.user.name} changed the group name to "${groupName.trim()}"`);
            }
            if (groupAvatar !== undefined && groupAvatar !== oldAvatar) {
                conversation.groupAvatar = groupAvatar;
                changes.push(`${req.user.name} changed the group icon`);
            }
            if (groupDescription !== undefined && groupDescription.trim() !== (oldDescription || "")) {
                conversation.groupDescription = groupDescription.trim();
                changes.push(`${req.user.name} changed the group description`);
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

        // Realtime broadcast to all group members
        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                io.to(`user:${pId}`).emit("group:updated", formatted);
            });
        }

        // Broadcast system messages for each change made
        for (const changeText of changes) {
            await createAndBroadcastSystemMessage(
                id,
                req.user._id,
                changeText,
                io,
                populated.participants
            );
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
        const isParticipant = conversation.participants.some(
            (p) => (p?._id || p).toString() === userId
        );

        if (!isParticipant) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group",
            });
        }

        const isOwner = conversation.groupAdmin?.toString() === userId;
        const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);
        const isAdmin = isOwner || isCoAdmin;
        const onlyAdminsCanAdd = conversation.groupSettings?.onlyAdminsCanAddMembers ?? false;

        if (!isAdmin && onlyAdminsCanAdd) {
            return res.status(403).json({
                success: false,
                message: "Only group admins can add members to this group",
            });
        }

        const currentSet = new Set(
            conversation.participants.map((p) => (p?._id || p).toString())
        );

        const now = new Date();
        if (!conversation.participantJoinedAt) {
            conversation.participantJoinedAt = [];
        }

        // For existing participants without join records, default to conversation.createdAt
        conversation.participants.forEach((p) => {
            const pIdStr = (p?._id || p).toString();
            if (!conversation.participantJoinedAt.some((pj) => (pj.user?._id || pj.user).toString() === pIdStr)) {
                conversation.participantJoinedAt.push({
                    user: p,
                    joinedAt: conversation.createdAt || now,
                });
            }
        });

        // Add newly added members with join time = now
        const newlyAddedIds = [];
        members.forEach((mId) => {
            const mIdStr = mId.toString();
            if (!currentSet.has(mIdStr)) {
                currentSet.add(mIdStr);
                newlyAddedIds.push(mIdStr);

                // If previously in pastParticipants or hiddenFor, remove them
                if (conversation.pastParticipants) {
                    conversation.pastParticipants = conversation.pastParticipants.filter(
                        (p) => (p?._id || p).toString() !== mIdStr
                    );
                }
                if (conversation.hiddenFor) {
                    conversation.hiddenFor = conversation.hiddenFor.filter(
                        (p) => (p?._id || p).toString() !== mIdStr
                    );
                }

                // Update or push join record
                const existingEntry = conversation.participantJoinedAt.find(
                    (pj) => (pj.user?._id || pj.user).toString() === mIdStr
                );
                if (existingEntry) {
                    existingEntry.joinedAt = now;
                    existingEntry.leftAt = null;
                } else {
                    conversation.participantJoinedAt.push({
                        user: mId,
                        joinedAt: now,
                        leftAt: null,
                    });
                }
            }
        });

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

        // Realtime broadcast to all group members (formatted per member)
        const io = req.app.get("io");
        if (io) {
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                const memberFormatted = formatConversationForClient(populated, pId);
                io.to(`user:${pId}`).emit("group:updated", memberFormatted);
            });
        }

        // Query added members' names to show in the system message
        if (newlyAddedIds.length > 0) {
            const addedUsers = await User.find({ _id: { $in: newlyAddedIds } }).select("name");
            const addedNames = addedUsers.map((u) => u.name).filter(Boolean).join(", ");
            await createAndBroadcastSystemMessage(
                id,
                req.user._id,
                `${req.user.name} added ${addedNames || "new member(s)"}`,
                io,
                populated.participants
            );
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

        // Find target user's name before removing from list
        const targetUser = await User.findById(targetId).select("name");

        conversation.participants = conversation.participants.filter(
            (p) => (p?._id || p).toString() !== targetId
        );

        if (!conversation.pastParticipants) {
            conversation.pastParticipants = [];
        }
        if (!conversation.pastParticipants.some((p) => (p?._id || p).toString() === targetId)) {
            conversation.pastParticipants.push(targetId);
        }

        const now = new Date();
        if (!conversation.participantJoinedAt) {
            conversation.participantJoinedAt = [];
        }
        const targetJoinedEntry = conversation.participantJoinedAt.find(
            (pj) => (pj.user?._id || pj.user).toString() === targetId
        );
        if (targetJoinedEntry) {
            targetJoinedEntry.leftAt = now;
        } else {
            conversation.participantJoinedAt.push({
                user: targetId,
                joinedAt: conversation.createdAt || now,
                leftAt: now,
            });
        }

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
            // Send updated group state to the member who left / was removed (with isLeft: true)
            const targetFormatted = formatConversationForClient(populated, targetId);
            io.to(`user:${targetId}`).emit("group:updated", targetFormatted);

            // Broadcast updated group to remaining participants
            populated.participants.forEach((p) => {
                const pId = (p?._id || p).toString();
                const memberFormatted = formatConversationForClient(populated, pId);
                io.to(`user:${pId}`).emit("group:updated", memberFormatted);
            });
        }

        // Broadcast system audit message (left or removed)
        const sysMsgText = isSelfLeaving
            ? `${req.user.name} left the group`
            : `${req.user.name} removed ${targetUser?.name || "a member"}`;

        const allAudience = [...populated.participants, targetId];
        await createAndBroadcastSystemMessage(
            id,
            req.user._id,
            sysMsgText,
            io,
            allAudience
        );

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

        const targetUser = await User.findById(targetId).select("name");

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

        // Broadcast role change system message
        const roleMsgText = isNowAdmin
            ? `${req.user.name} made ${targetUser?.name || "a member"} a group admin`
            : `${req.user.name} dismissed ${targetUser?.name || "a member"} as group admin`;

        await createAndBroadcastSystemMessage(
            id,
            req.user._id,
            roleMsgText,
            io,
            populated.participants
        );

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

// Delete / Hide Conversation for logged-in user (Clears from list & deletes messages for user)
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findOne({
            _id: id,
            $or: [
                { participants: userId },
                { pastParticipants: userId },
                { "participantJoinedAt.user": userId },
            ],
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        if (!conversation.hiddenFor) {
            conversation.hiddenFor = [];
        }
        if (!conversation.hiddenFor.some((u) => (u?._id || u).toString() === userId.toString())) {
            conversation.hiddenFor.push(userId);
        }

        // Also remove from pinnedBy if pinned
        if (conversation.pinnedBy) {
            conversation.pinnedBy = conversation.pinnedBy.filter(
                (u) => (u?._id || u).toString() !== userId.toString()
            );
        }

        await conversation.save();

        // Mark all messages as deletedFor this user
        await Message.updateMany(
            { conversation: id, deletedFor: { $ne: userId } },
            { $addToSet: { deletedFor: userId } }
        );

        res.status(200).json({
            success: true,
            conversationId: id,
            message: "Conversation deleted successfully",
        });
    } catch (error) {
        console.error("Delete conversation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete conversation",
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
    deleteConversation,
};