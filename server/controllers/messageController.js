import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";


// Send message
const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      text,
      messageType = "text",
      fileUrl = "",
      fileName = "",
      fileSize = 0,
      duration = 0,
      replyTo = null,
    } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    if ((!text || !text.trim()) && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    // Find conversation
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Check current user is participant
    const isParticipant = conversation.participants.some(
      (participant) =>
        participant.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant of this conversation",
      });
    }

    // Find receiver for 1-on-1 chats
    let receiverId = null;
    if (!conversation.isGroup) {
      receiverId = conversation.participants.find(
        (participant) => participant.toString() !== req.user._id.toString()
      );

      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: "Receiver not found",
        });
      }

      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: "Receiver not found",
        });
      }
    }

    const finalType =
      messageType ||
      (fileUrl
        ? fileUrl.startsWith("data:audio")
          ? "audio"
          : fileUrl.startsWith("data:image")
          ? "image"
          : "file"
        : "text");

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      receiver: receiverId || null,
      text: text ? text.trim() : "",
      messageType: finalType,
      fileUrl: fileUrl || "",
      fileName: fileName || "",
      fileSize: fileSize || 0,
      duration: duration || 0,
      replyTo: replyTo || null,
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();

    await conversation.save();

    // Populate sender, receiver, reactions, and replyTo
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name phone profilePicture isOnline")
      .populate("receiver", "name phone profilePicture isOnline")
      .populate("reactions.user", "name profilePicture")
      .populate({
        path: "replyTo",
        select: "text messageType fileName fileUrl sender",
        populate: { path: "sender", select: "name" },
      });

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send message",
    });
  }
};

// Get messages of conversation
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Check participant
    const isParticipant = conversation.participants.some(
      (participant) =>
        participant.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant of this conversation",
      });
    }

    // Exclude messages deleted for current user
    const messages = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: req.user._id },
    })
      .populate("sender", "name phone profilePicture isOnline")
      .populate("receiver", "name phone profilePicture isOnline")
      .populate("reactions.user", "name profilePicture")
      .populate({
        path: "replyTo",
        select: "text messageType fileName fileUrl sender",
        populate: { path: "sender", select: "name" },
      })
      .sort({
        createdAt: 1,
      });

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get messages",
    });
  }
};

// React to a message (toggle emoji reaction)
const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: "Emoji is required",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check if user is participant of this conversation
    const userId = req.user._id.toString();
    const conversation = await Conversation.findById(message.conversation);
    const isParticipant = conversation?.participants.some(
      (p) => p.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to react to this message",
      });
    }

    // Check if user already reacted
    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        // Same emoji: toggle off (remove)
        message.reactions.splice(existingIndex, 1);
      } else {
        // Different emoji: update
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      // New reaction
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await message.save();

    const populated = await Message.findById(message._id).populate(
      "reactions.user",
      "name profilePicture"
    );

    res.status(200).json({
      success: true,
      messageId: message._id,
      conversationId: message.conversation,
      reactions: populated.reactions,
    });
  } catch (error) {
    console.error("React to message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to react to message",
    });
  }
};

// Delete a message (for me OR for everyone)
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType = "forEveryone" } = req.body; // "forEveryone" | "forMe"
    const userId = req.user._id.toString();

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check permission
    const isSender = message.sender.toString() === userId;
    const conversation = await Conversation.findById(message.conversation);
    const isParticipant = conversation?.participants.some(
      (p) => p.toString() === userId
    );

    if (!isSender && !isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (deleteType === "forEveryone") {
      if (!isSender) {
        return res.status(403).json({
          success: false,
          message: "Only the sender can delete a message for everyone",
        });
      }

      message.isDeleted = true;
      message.deletedForEveryone = true;
      message.text = "This message was deleted";
      message.fileUrl = "";
      message.fileName = "";
      message.fileSize = 0;
      message.duration = 0;
      message.reactions = [];

      await message.save();

      return res.status(200).json({
        success: true,
        messageId: message._id,
        conversationId: message.conversation,
        deleteType: "forEveryone",
      });
    } else {
      // deleteType === "forMe"
      if (!message.deletedFor.includes(req.user._id)) {
        message.deletedFor.push(req.user._id);
        await message.save();
      }

      return res.status(200).json({
        success: true,
        messageId: message._id,
        conversationId: message.conversation,
        deleteType: "forMe",
      });
    }
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete message",
    });
  }
};

// Star / Unstar message
const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (!message.starredBy) {
      message.starredBy = [];
    }

    const isStarredIndex = message.starredBy.findIndex(
      (id) => id.toString() === userId.toString()
    );

    let isStarred = false;
    if (isStarredIndex > -1) {
      message.starredBy.splice(isStarredIndex, 1);
      isStarred = false;
    } else {
      message.starredBy.push(userId);
      isStarred = true;
    }

    await message.save();

    res.status(200).json({
      success: true,
      messageId: message._id,
      conversationId: message.conversation,
      isStarred,
      starredBy: message.starredBy,
    });
  } catch (error) {
    console.error("Toggle star message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update star status",
    });
  }
};

// Get starred messages for current user
const getStarredMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.query;

    const filter = {
      starredBy: userId,
      isDeleted: false,
      deletedFor: { $ne: userId },
    };

    if (conversationId) {
      filter.conversation = conversationId;
    }

    const starredMessages = await Message.find(filter)
      .populate("sender", "name phone profilePicture")
      .populate("conversation", "isGroup groupName groupAvatar participants")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      starredMessages,
    });
  } catch (error) {
    console.error("Get starred messages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch starred messages",
    });
  }
};

// Forward a message to one or multiple conversations
const forwardMessage = async (req, res) => {
  try {
    const { messageId, targetConversationIds } = req.body;
    const userId = req.user._id;

    if (!messageId || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message ID and target conversations are required",
      });
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: "Original message not found",
      });
    }

    const io = req.app.get("io");
    const forwardedMessages = [];

    for (const convId of targetConversationIds) {
      const conv = await Conversation.findById(convId);
      if (!conv) continue;

      const isParticipant = conv.participants.some(
        (p) => p.toString() === userId.toString()
      );
      if (!isParticipant) continue;

      let receiverId = null;
      if (!conv.isGroup) {
        receiverId = conv.participants.find(
          (p) => p.toString() !== userId.toString()
        );
      }

      const newMsg = new Message({
        conversation: conv._id,
        sender: userId,
        receiver: receiverId || null,
        text: originalMessage.text,
        messageType: originalMessage.messageType,
        fileUrl: originalMessage.fileUrl,
        fileName: originalMessage.fileName,
        fileSize: originalMessage.fileSize,
        duration: originalMessage.duration,
        isForwarded: true,
      });

      await newMsg.save();

      conv.lastMessage = newMsg._id;
      conv.lastMessageAt = new Date();
      await conv.save();

      const populated = await Message.findById(newMsg._id)
        .populate("sender", "name phone profilePicture isOnline")
        .populate("receiver", "name phone profilePicture isOnline");

      forwardedMessages.push(populated);

      // Broadcast to participants
      if (io) {
        conv.participants.forEach((pId) => {
          io.to(`user:${pId.toString()}`).emit("newMessage", populated);
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Message forwarded to ${forwardedMessages.length} conversation(s)`,
      forwardedMessages,
    });
  } catch (error) {
    console.error("Forward message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to forward message",
    });
  }
};

export {
  sendMessage,
  getMessages,
  reactToMessage,
  deleteMessage,
  toggleStarMessage,
  getStarredMessages,
  forwardMessage,
};