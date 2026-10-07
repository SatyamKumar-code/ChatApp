import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Call from "../models/Call.js";
import PendingFileDelivery from "../models/PendingFileDelivery.js";
import PushSubscription from "../models/PushSubscription.js";
import { deleteTemporaryFile } from "../services/fileStorageService.js";
import { sendMessagePush, sendCallPush } from "../services/pushService.js";

// Map<userId, Set<socketId>> — supports multiple devices per user
const onlineUsers = new Map();
// Map<callPairKey, activeCallInfo>
export const activeCalls = new Map();
// Map<conversationId, activeGroupCallInfo>
export const activeGroupCalls = new Map();

const parseCookies = (cookieHeader) => {
  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) return;

    cookies[name] = decodeURIComponent(
      valueParts.join("=")
    );
  });

  return cookies;
};

let ioInstance = null;

/**
 * Check if a user has any active socket connections
 */
const isUserOnline = (userId) => {
  if (!userId) return false;
  const idStr = (userId._id || userId).toString();
  const sockets = onlineUsers.get(idStr);
  if (!sockets || sockets.size === 0) return false;

  if (ioInstance && ioInstance.sockets?.sockets) {
    let hasAlive = false;
    for (const sId of Array.from(sockets)) {
      if (ioInstance.sockets.sockets.has(sId)) {
        hasAlive = true;
      } else {
        sockets.delete(sId);
      }
    }
    if (!hasAlive) {
      onlineUsers.delete(idStr);
      return false;
    }
    return true;
  }

  return sockets.size > 0;
};

const setupSocket = (io) => {
  ioInstance = io;
  // ==============================
  // SOCKET AUTHENTICATION
  // ==============================

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      let userId = null;

      if (cookies.accessToken) {
        try {
          const decoded = jwt.verify(
            cookies.accessToken,
            process.env.JWT_ACCESS_SECRET
          );
          userId = decoded.userId;
        } catch (jwtErr) {
          // Access token might be expired; fallback to refreshToken below
        }
      }

      // Fallback: If accessToken is missing or expired, check valid refreshToken
      if (!userId && cookies.refreshToken) {
        try {
          const refreshDecoded = jwt.verify(
            cookies.refreshToken,
            process.env.JWT_REFRESH_SECRET
          );
          userId = refreshDecoded.userId;
        } catch (rErr) {
          // Both tokens invalid or expired
        }
      }

      if (!userId) {
        return next(new Error("Authentication required"));
      }

      const user = await User.findById(userId).select(
        "_id name phone profilePic isOnline lastSeen"
      );

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Invalid socket authentication"));
    }
  });

  // ==============================
  // CONNECTION
  // ==============================

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    if(process.env.NODE_ENV !== "production"){
      console.log(
        `Socket connected: ${socket.user.name} (${userId}) [${socket.id}]`
      );
    }

    // Join personal user room
    socket.join(`user:${userId}`);

    // ==============================
    // MULTIPLE DEVICE HANDLING
    // ==============================
    // Add this socket to the user's set of sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Mark online
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
    });

    // Confirm connection
    socket.emit("socket:connected", {
      socketId: socket.id,
      userId,
    });

    // Notify other users
    socket.broadcast.emit("user:online", {
      userId,
    });

    // ==============================
    // ON CONNECT: DELIVER PENDING MESSAGES
    // ==============================
    // Mark all undelivered messages sent TO this user as delivered, notify senders, and emit to receiver!
    try {
      const userConvs = await Conversation.find({
        participants: userId,
      }).select("_id").lean();
      const userConvIds = userConvs.map((c) => c._id);

      const undeliveredMessages = await Message.find({
        $or: [
          { receiver: userId, isDelivered: false },
          { conversation: { $in: userConvIds }, sender: { $ne: userId }, isDelivered: false },
        ],
        deletedFor: { $nin: [userId] },
      })
        .populate("sender", "name phone profilePicture isOnline")
        .populate("receiver", "name phone profilePicture isOnline")
        .populate("reactions.user", "name profilePicture")
        .populate({
          path: "replyTo",
          select: "text messageType fileName fileUrl sender",
          populate: { path: "sender", select: "name" },
        })
        .sort({ createdAt: 1 });

      if (undeliveredMessages.length > 0) {
        const messageIds = undeliveredMessages.map((msg) => msg._id);

        await Message.updateMany(
          { _id: { $in: messageIds } },
          { isDelivered: true }
        );

        // Group by sender and notify each sender
        const senderGroups = {};
        for (const msg of undeliveredMessages) {
          const senderId = (msg.sender?._id || msg.sender).toString();
          if (!senderGroups[senderId]) {
            senderGroups[senderId] = [];
          }
          senderGroups[senderId].push({
            messageId: msg._id.toString(),
            conversationId: (msg.conversation?._id || msg.conversation).toString(),
          });
        }

        for (const [senderId, deliveredMsgs] of Object.entries(senderGroups)) {
          io.to(`user:${senderId}`).emit("message:delivered", {
            messages: deliveredMsgs,
          });
        }

        // Emit each pending offline message to the newly connected receiver socket
        for (const msg of undeliveredMessages) {
          socket.emit("newMessage", msg);
        }

        // Also emit a dedicated batch event so client can pop up all OS notifications together
        socket.emit("messages:offline_batch", {
          messages: undeliveredMessages,
          count: undeliveredMessages.length,
        });

        console.log(
          `Delivered and pushed ${messageIds.length} pending offline messages to ${socket.user.name}`
        );
      }
    } catch (error) {
      console.error("Error delivering pending messages:", error);
    }

    // ==============================
    // ON CONNECT: OFFLINE FILE DELIVERY NOTIFICATIONS
    // ==============================
    try {
      // Find all files where receiverId = currentUser AND status in pending_delivery / available
      const pendingDeliveries = await PendingFileDelivery.find({
        receiverId: userId,
        status: {
          $in: [
            "pending_delivery",
            "receiver_online",
            "download_available",
            "available",
            "downloading",
          ],
        },
        expiresAt: { $gt: new Date() },
      });

      if (pendingDeliveries.length > 0) {
        console.log(
          `[OfflineFiles] Found ${pendingDeliveries.length} waiting files for ${socket.user.name}`
        );

        socket.emit("file:pending_list", {
          pendingFiles: pendingDeliveries,
        });

        // Notify senders that receiver is now online
        for (const item of pendingDeliveries) {
          if (item.status === "pending_delivery") {
            item.status = "download_available";
            await item.save();
          }

          io.to(`user:${item.senderId.toString()}`).emit("file:status_update", {
            fileId: item.fileId,
            messageId: item.messageId,
            status: "download_available",
            receiverOnline: true,
          });
        }
      }

      // Check if this user is a sender with pending re-upload requests
      const pendingReuploads = await PendingFileDelivery.find({
        senderId: userId,
        status: "waiting_for_sender",
        expiresAt: { $gt: new Date() },
      });

      for (const item of pendingReuploads) {
        socket.emit("file:request_reupload", {
          fileId: item.fileId,
          messageId: item.messageId,
          fileName: item.fileName,
          fileType: item.fileType,
          fileSize: item.fileSize,
          receiverId: item.receiverId.toString(),
        });
      }
    } catch (error) {
      console.error("[OfflineFiles] Error checking pending deliveries:", error);
    }

    // ==============================
    // FILE TRANSFER SOCKET HANDLERS
    // ==============================
    socket.on("file:download_complete", async (payload) => {
      try {
        const { fileId } = payload || {};
        if (!fileId) return;

        const delivery = await PendingFileDelivery.findOne({ fileId });
        if (delivery) {
          delivery.status = "completed";
          delivery.acknowledgedAt = new Date();
          delivery.downloadProgress = 100;
          await delivery.save();

          if (delivery.messageId) {
            await Message.updateOne(
              { _id: delivery.messageId },
              { fileTransferStatus: "downloaded", isDelivered: true }
            );
          }

          // Keep temporary file available during retention period
          io.to(`user:${delivery.senderId.toString()}`).emit("file:status_update", {
            fileId,
            messageId: delivery.messageId,
            status: "downloaded",
          });

          io.to(`user:${delivery.receiverId.toString()}`).emit("file:status_update", {
            fileId,
            messageId: delivery.messageId,
            status: "downloaded",
          });
        }
      } catch (err) {
        console.error("file:download_complete socket error:", err);
      }
    });

    socket.on("file:reupload_failed", async (payload) => {
      try {
        const { fileId } = payload || {};
        if (!fileId) return;

        const delivery = await PendingFileDelivery.findOne({ fileId });
        if (delivery) {
          delivery.status = "unavailable";
          delivery.senderAvailableForReupload = false;
          await delivery.save();

          if (delivery.messageId) {
            await Message.updateOne(
              { _id: delivery.messageId },
              { fileTransferStatus: "unavailable" }
            );
          }

          io.to(`user:${delivery.receiverId.toString()}`).emit("file:status_update", {
            fileId,
            status: "unavailable",
            message: "File is currently unavailable.",
          });
        }
      } catch (err) {
        console.error("file:reupload_failed socket error:", err);
      }
    });

    // ==============================
    // SEND MESSAGE
    // ==============================

    socket.on("sendMessage", async (data) => {
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
          isForwarded = false,
          tempId = null,
        } = data;

        // Validate conversation ID
        if (!conversationId) {
          return socket.emit(
            "message:error",
            {
              message:
                "Conversation ID is required",
            }
          );
        }

        // Validate content
        if ((!text || !text.trim()) && !fileUrl) {
          return socket.emit(
            "message:error",
            {
              message:
                "Message cannot be empty",
            }
          );
        }

        // Find conversation
        const conversation =
          await Conversation.findById(
            conversationId
          );

        if (!conversation) {
          return socket.emit(
            "message:error",
            {
              message:
                "Conversation not found",
            }
          );
        }

        // Check sender is participant
        const isParticipant =
          conversation.participants.some(
            (participant) =>
              participant.toString() ===
              userId
          );

        if (!isParticipant) {
          return socket.emit(
            "message:error",
            {
              message:
                "You are not a participant of this conversation",
            }
          );
        }

        // Check group message sending permission
        if (conversation.isGroup && conversation.groupSettings?.onlyAdminsCanSendMessages) {
          const isOwner = conversation.groupAdmin?.toString() === userId;
          const isCoAdmin =
            conversation.groupAdmins &&
            conversation.groupAdmins.some((a) => (a?._id || a).toString() === userId);

          if (!isOwner && !isCoAdmin) {
            return socket.emit("message:error", {
              message: "Only group admins can send messages in this group",
            });
          }
        }

        // Handle receiver for 1-on-1 vs group
        let receiverId = null;
        let receiverIsOnline = false;

        if (!conversation.isGroup) {
          receiverId = conversation.participants.find(
            (participant) => participant.toString() !== userId
          );

          if (!receiverId) {
            return socket.emit("message:error", {
              message: "Receiver not found",
            });
          }

          const receiver = await User.findById(receiverId);
          if (!receiver) {
            return socket.emit("message:error", {
              message: "Receiver not found",
            });
          }

          // Check if receiver has blocked current user
          var isBlockedByReceiver = Boolean(
            receiver?.blockedUsers &&
            receiver.blockedUsers.some(
              (bId) => (bId?._id || bId).toString() === userId
            )
          );

          receiverIsOnline = !isBlockedByReceiver && isUserOnline(receiverId.toString());
        }

        const finalType = messageType || (fileUrl ? (fileUrl.startsWith("data:audio") ? "audio" : fileUrl.startsWith("data:image") ? "image" : "file") : "text");

        // Save message
        const message =
          await Message.create({
            conversation: conversationId,
            sender: socket.user._id,
            receiver: receiverId || null,
            text: text ? text.trim() : "",
            messageType: finalType,
            fileUrl: fileUrl || "",
            fileName: fileName || "",
            fileSize: fileSize || 0,
            duration: duration || 0,
            replyTo: replyTo || null,
            isDelivered: !conversation.isGroup && !isBlockedByReceiver ? receiverIsOnline : false,
            isSeen: false,
            isForwarded: Boolean(isForwarded),
            deletedFor: isBlockedByReceiver ? [receiverId] : [],
          });

        // Update conversation lastMessage only if receiver has not blocked sender
        if (!isBlockedByReceiver) {
          conversation.lastMessage = message._id;
          conversation.lastMessageAt = new Date();
          await conversation.save();
        }

        // Populate message
        const populatedMessage =
          await Message.findById(
            message._id
          )
            .populate(
              "sender",
              "name phone profilePicture isOnline"
            )
            .populate(
              "receiver",
              "name phone profilePicture isOnline"
            )
            .populate(
              "reactions.user",
              "name profilePicture"
            )
            .populate({
              path: "replyTo",
              select: "text messageType fileName fileUrl sender",
              populate: { path: "sender", select: "name" },
            });

        // ==============================
        // BROADCAST NEW MESSAGE
        // ==============================
        const senderMessagePayload = tempId
          ? { ...(populatedMessage.toObject ? populatedMessage.toObject() : populatedMessage), tempId }
          : populatedMessage;

        if (conversation.isGroup) {
          conversation.participants.forEach((pId) => {
            const isSender = pId.toString() === userId;
            io.to(`user:${pId.toString()}`).emit(
              "newMessage",
              isSender ? senderMessagePayload : populatedMessage
            );
          });
        } else {
          // Always emit to sender so sender sees their own message
          io.to(`user:${userId}`).emit(
            "newMessage",
            senderMessagePayload
          );

          // Emit to receiver ONLY if receiver has not blocked the sender
          if (!isBlockedByReceiver) {
            io.to(
              `user:${receiverId.toString()}`
            ).emit(
              "newMessage",
              populatedMessage
            );

            if (receiverIsOnline) {
              io.to(`user:${userId}`).emit(
                "message:delivered",
                {
                  messages: [
                    {
                      messageId: message._id.toString(),
                      conversationId: conversationId,
                    },
                  ],
                }
              );
            }
          }
        }

        // Trigger Web Push Notification for offline or background devices
        try {
          const recipientIds = conversation.isGroup
            ? conversation.participants
                .filter((pId) => (pId?._id || pId).toString() !== userId)
                .map((pId) => (pId?._id || pId).toString())
            : (!isBlockedByReceiver && receiverId ? [receiverId.toString()] : []);

          if (recipientIds.length > 0) {
            sendMessagePush({
              sender: socket.user,
              conversation,
              message: populatedMessage,
              recipientIds,
            }).catch((pErr) => console.error("Send message push error:", pErr));
          }
        } catch (pushErr) {
          console.error("Message push dispatch error:", pushErr);
        }

        console.log(
          `Message sent in ${conversation.isGroup ? "group" : "direct"}: ${conversationId}`
        );
      } catch (error) {
        console.error(
          "Socket send message error:",
          error
        );

        socket.emit(
          "message:error",
          {
            message:
              "Failed to send message",
          }
        );
      }
    });

    // ==============================
    // REACT TO MESSAGE
    // ==============================

    socket.on("message:react", async (data) => {
      try {
        const { messageId, emoji, conversationId } = data;

        if (!messageId || !emoji) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        const conv = await Conversation.findById(message.conversation);
        if (!conv) return;

        const isParticipant = conv.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return;

        // Toggle or update reaction
        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (existingIndex > -1) {
          if (message.reactions[existingIndex].emoji === emoji) {
            message.reactions.splice(existingIndex, 1);
          } else {
            message.reactions[existingIndex].emoji = emoji;
          }
        } else {
          message.reactions.push({
            user: socket.user._id,
            emoji,
          });
        }

        await message.save();

        const populated = await Message.findById(messageId).populate(
          "reactions.user",
          "name profilePicture"
        );

        const reactionPayload = {
          messageId: message._id.toString(),
          conversationId: (conversationId || message.conversation).toString(),
          reactions: populated.reactions,
        };

        conv.participants.forEach((pId) => {
          io.to(`user:${pId.toString()}`).emit(
            "message:reactionUpdated",
            reactionPayload
          );
        });
      } catch (error) {
        console.error("Socket react error:", error);
      }
    });

    // ==============================
    // DELETE MESSAGE
    // ==============================

    socket.on("message:delete", async (data) => {
      try {
        const { messageId, deleteType = "forEveryone", conversationId } = data;

        if (!messageId) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        const conv = await Conversation.findById(message.conversation);
        if (!conv) return;

        const senderId = message.sender.toString();
        const isParticipant = conv.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return;

        if (deleteType === "forEveryone") {
          if (senderId !== userId) return; // Only sender can delete for everyone

          message.isDeleted = true;
          message.deletedForEveryone = true;
          message.text = "This message was deleted";
          message.fileUrl = "";
          message.fileName = "";
          message.fileSize = 0;
          message.duration = 0;
          message.reactions = [];

          await message.save();

          const deletePayload = {
            messageId: message._id.toString(),
            conversationId: (conversationId || message.conversation).toString(),
            deleteType: "forEveryone",
          };

          conv.participants.forEach((pId) => {
            io.to(`user:${pId.toString()}`).emit(
              "message:deleted",
              deletePayload
            );
          });
        } else {
          // For me
          if (!message.deletedFor.includes(socket.user._id)) {
            message.deletedFor.push(socket.user._id);
            await message.save();
          }

          io.to(`user:${userId}`).emit("message:deleted", {
            messageId: message._id.toString(),
            conversationId: (conversationId || message.conversation).toString(),
            deleteType: "forMe",
          });
        }
      } catch (error) {
        console.error("Socket delete error:", error);
      }
    });

    // ==============================
    // MARK MESSAGES AS SEEN
    // ==============================

    socket.on("message:markSeen", async (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) return;

        // Find all unseen messages in this conversation not sent by current user
        const unseenMessages = await Message.find({
          conversation: conversationId,
          sender: { $ne: userId },
          isSeen: false,
        });

        const seenAt = new Date();

        if (unseenMessages.length > 0) {
          const messageIds = unseenMessages.map((msg) => msg._id);

          // Update messages
          await Message.updateMany(
            { _id: { $in: messageIds } },
            {
              isSeen: true,
              isDelivered: true,
              seenAt,
            }
          );
        }

        // Notify sender(s) and participants that messages in this conversation have been seen
        const conversation = await Conversation.findById(conversationId);
        if (conversation && conversation.participants) {
          const senderGroups = {};
          for (const msg of unseenMessages) {
            const senderId = (msg.sender?._id || msg.sender).toString();
            if (!senderGroups[senderId]) {
              senderGroups[senderId] = [];
            }
            senderGroups[senderId].push({
              messageId: msg._id.toString(),
              conversationId: conversationId.toString(),
            });
          }

          const otherParticipants = conversation.participants.filter(
            (p) => (p?._id || p).toString() !== userId
          );

          for (const pId of otherParticipants) {
            const participantId = (pId?._id || pId).toString();
            io.to(`user:${participantId}`).emit("message:seen", {
              conversationId: conversationId.toString(),
              messages: senderGroups[participantId] || [],
              seenAt,
              seenBy: userId,
            });
          }
        }
      } catch (error) {
        console.error(
          "Mark seen error:",
          error
        );
      }
    });

    // ==============================
    // TYPING INDICATOR
    // ==============================

    socket.on("typing:start", async (data) => {
      const { conversationId, receiverId } = data;

      if (!conversationId) return;

      if (receiverId) {
        io.to(`user:${receiverId}`).emit(
          "typing:start",
          {
            conversationId,
            userId,
            userName: socket.user.name,
          }
        );
      } else {
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          conv.participants.forEach((pId) => {
            if (pId.toString() !== userId) {
              io.to(`user:${pId.toString()}`).emit("typing:start", {
                conversationId,
                userId,
                userName: socket.user.name,
              });
            }
          });
        }
      }
    });

    socket.on("typing:stop", async (data) => {
      const { conversationId, receiverId } = data;

      if (!conversationId) return;

      if (receiverId) {
        io.to(`user:${receiverId}`).emit(
          "typing:stop",
          {
            conversationId,
            userId,
          }
        );
      } else {
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          conv.participants.forEach((pId) => {
            if (pId.toString() !== userId) {
              io.to(`user:${pId.toString()}`).emit("typing:stop", {
                conversationId,
                userId,
              });
            }
          });
        }
      }
    });

    // Helper to format call duration
    const formatCallDuration = (seconds) => {
      if (!seconds || seconds <= 0) return "";
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins === 0) return `${secs} sec`;
      return `${mins} min ${secs} sec`;
    };

    // Helper to create and broadcast Call Message into Conversation
    const createAndBroadcastCallMessage = async ({
      conversationId: cId,
      callerId,
      receiverId = null,
      callType = "video",
      status = "completed",
      duration = 0,
      isGroupCall = false,
    }) => {
      try {
        let targetConvId = cId;

        // If no conversationId given for 1-on-1, lookup conversation
        if (!targetConvId && callerId && receiverId) {
          const found = await Conversation.findOne({
            isGroup: false,
            participants: { $all: [callerId, receiverId] },
          });
          if (found) targetConvId = found._id;
        }

        if (!targetConvId) return;

        const conversation = await Conversation.findById(targetConvId);
        if (!conversation) return;

        const isVideo = callType === "video";
        const typeLabel = isVideo ? "Video call" : "Audio call";
        let messageText = "";

        if (isGroupCall) {
          const durationStr = formatCallDuration(duration);
          messageText = durationStr
            ? `Group ${typeLabel.toLowerCase()} • ${durationStr}`
            : `Group ${typeLabel.toLowerCase()}`;
        } else {
          if (status === "missed") {
            messageText = `Missed ${typeLabel.toLowerCase()}`;
          } else if (status === "rejected") {
            messageText = `Declined ${typeLabel.toLowerCase()}`;
          } else if (duration > 0) {
            messageText = `${typeLabel} • ${formatCallDuration(duration)}`;
          } else {
            messageText = typeLabel;
          }
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: callerId,
          receiver: receiverId || null,
          text: messageText,
          messageType: "call",
          callDetails: {
            callType,
            status,
            duration,
            isGroupCall: Boolean(isGroupCall),
          },
          isDelivered: true,
          isSeen: false,
        });

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        const populated = await Message.findById(message._id)
          .populate("sender", "name phone profilePicture isOnline")
          .populate("receiver", "name phone profilePicture isOnline");

        if (conversation.isGroup) {
          conversation.participants.forEach((pId) => {
            io.to(`user:${pId.toString()}`).emit("newMessage", populated);
          });
        } else {
          io.to(`user:${callerId.toString()}`).emit("newMessage", populated);
          if (receiverId) {
            io.to(`user:${receiverId.toString()}`).emit("newMessage", populated);
          }
        }
      } catch (err) {
        console.error("Create call message error:", err);
      }
    };

    // Helper to get call pair key
    const getCallKey = (u1, u2) => {
      return [u1, u2].sort().join(":");
    };

    // Initiate Call
    socket.on("call:initiate", async (data) => {
      try {
        const { receiverId, callType = "video", conversationId } = data;

        if (!receiverId) return;

        // Check if caller or receiver has blocked the other
        const [callerUser, receiverUser] = await Promise.all([
          User.findById(userId),
          User.findById(receiverId),
        ]);

        if (
          callerUser?.blockedUsers?.some((b) => (b?._id || b).toString() === receiverId.toString()) ||
          receiverUser?.blockedUsers?.some((b) => (b?._id || b).toString() === userId.toString())
        ) {
          return socket.emit("call:rejected", {
            reason: "User is unavailable / blocked",
          });
        }

        const receiverOnline = isUserOnline(receiverId.toString());
        const pushSubCount = await PushSubscription.countDocuments({ userId: receiverId });

        if (!receiverOnline && pushSubCount === 0) {
          // Log missed/offline call attempt
          try {
            const callDoc = await Call.create({
              caller: socket.user._id,
              receiver: receiverId,
              callType,
              status: "missed",
              duration: 0,
              conversation: conversationId || null,
            });
            const populated = await Call.findById(callDoc._id)
              .populate("caller", "name phone profilePicture isOnline")
              .populate("receiver", "name phone profilePicture isOnline");
            socket.emit("call:newRecord", populated);
          } catch (e) {
            console.error("Save offline call error:", e);
          }

          // Create missed call message in chat
          createAndBroadcastCallMessage({
            conversationId,
            callerId: socket.user._id,
            receiverId,
            callType,
            status: "missed",
            duration: 0,
            isGroupCall: false,
          });

          return socket.emit("call:userOffline", {
            receiverId,
            message: "User is currently offline",
          });
        }

        // Create initial Call log record in DB
        let callDocId = null;
        try {
          const callDoc = await Call.create({
            caller: socket.user._id,
            receiver: receiverId,
            callType,
            status: "missed", // default unless answered
            duration: 0,
            conversation: conversationId || null,
          });
          callDocId = callDoc._id;
        } catch (dbErr) {
          console.error("Create call doc error:", dbErr);
        }

        // Track active call state
        const callKey = getCallKey(userId, receiverId.toString());

        // 40-second timeout if call is unanswered
        const timeoutId = setTimeout(async () => {
          const curCall = activeCalls.get(callKey);
          if (curCall && curCall.callDocId?.toString() === callDocId?.toString() && !curCall.startTime) {
            activeCalls.delete(callKey);
            socket.emit("call:rejected", {
              reason: "no_answer",
              message: "No answer",
            });
            createAndBroadcastCallMessage({
              conversationId,
              callerId: socket.user._id,
              receiverId,
              callType,
              status: "missed",
              duration: 0,
              isGroupCall: false,
            });
          }
        }, 40000);

        activeCalls.set(callKey, {
          callDocId,
          callerId: userId,
          receiverId: receiverId.toString(),
          callType,
          conversationId,
          startTime: null,
          timeoutId,
        });

        // Send incoming call alert to receiver over Socket.IO if online
        if (receiverOnline) {
          io.to(`user:${receiverId.toString()}`).emit("call:incoming", {
            caller: {
              _id: socket.user._id,
              name: socket.user.name,
              profilePicture: socket.user.profilePicture,
              phone: socket.user.phone,
            },
            callType,
            conversationId,
            callId: callDocId,
          });
        }

        // Send high-priority Web Push Notification (wakes closed PWA / background)
        sendCallPush({
          caller: socket.user,
          receiverId,
          callType,
          callId: callDocId,
          conversationId,
        }).catch((err) => console.error("Send call push error:", err));

        console.log(`Call initiated: ${socket.user.name} -> ${receiverId} (${callType})`);
      } catch (err) {
        console.error("Call initiate error:", err);
      }
    });

    // Accept Call
    socket.on("call:accept", async (data) => {
      try {
        const { callerId } = data;
        if (!callerId) return;

        const callKey = getCallKey(userId, callerId.toString());
        const callInfo = activeCalls.get(callKey);

        if (callInfo) {
          if (callInfo.timeoutId) clearTimeout(callInfo.timeoutId);
          callInfo.startTime = Date.now();
          if (callInfo.callDocId) {
            await Call.findByIdAndUpdate(callInfo.callDocId, {
              status: "completed",
            });
          }
        }

        io.to(`user:${callerId.toString()}`).emit("call:accepted", {
          acceptedBy: {
            _id: socket.user._id,
            name: socket.user.name,
            profilePicture: socket.user.profilePicture,
          },
        });

        console.log(`Call accepted by ${socket.user.name} for ${callerId}`);
      } catch (err) {
        console.error("Call accept error:", err);
      }
    });

    // Reject Call
    socket.on("call:reject", async (data) => {
      try {
        const { callerId, reason = "declined" } = data;
        if (!callerId) return;

        const callKey = getCallKey(userId, callerId.toString());
        const callInfo = activeCalls.get(callKey);

        if (callInfo) {
          if (callInfo.timeoutId) clearTimeout(callInfo.timeoutId);
          if (callInfo.callDocId) {
            await Call.findByIdAndUpdate(callInfo.callDocId, {
              status: reason === "busy" ? "missed" : "rejected",
            });
            const populated = await Call.findById(callInfo.callDocId)
              .populate("caller", "name phone profilePicture isOnline")
              .populate("receiver", "name phone profilePicture isOnline");

            if (populated) {
              io.to(`user:${callerId.toString()}`).emit("call:newRecord", populated);
              io.to(`user:${userId}`).emit("call:newRecord", populated);
            }

            // Broadcast Call message into Chat
            createAndBroadcastCallMessage({
              conversationId: callInfo.conversationId,
              callerId: callInfo.callerId,
              receiverId: callInfo.receiverId,
              callType: callInfo.callType,
              status: reason === "busy" ? "missed" : "rejected",
              duration: 0,
              isGroupCall: false,
            });
          }
          activeCalls.delete(callKey);
        }

        io.to(`user:${callerId.toString()}`).emit("call:rejected", {
          callerId,
          rejectedBy: socket.user._id,
          reason,
        });

        console.log(`Call rejected by ${socket.user.name} for ${callerId} (${reason})`);
      } catch (err) {
        console.error("Call reject error:", err);
      }
    });

    // End / Hangup Call
    socket.on("call:end", async (data) => {
      try {
        const { targetUserId } = data;
        if (!targetUserId) return;

        const callKey = getCallKey(userId, targetUserId.toString());
        const callInfo = activeCalls.get(callKey);

        if (callInfo) {
          if (callInfo.timeoutId) clearTimeout(callInfo.timeoutId);
          let duration = 0;
          if (callInfo.startTime) {
            duration = Math.max(1, Math.floor((Date.now() - callInfo.startTime) / 1000));
          }

          if (callInfo.callDocId) {
            await Call.findByIdAndUpdate(callInfo.callDocId, {
              duration,
              status: callInfo.startTime ? "completed" : "missed",
            });

            const populated = await Call.findById(callInfo.callDocId)
              .populate("caller", "name phone profilePicture isOnline")
              .populate("receiver", "name phone profilePicture isOnline");

            if (populated) {
              io.to(`user:${userId}`).emit("call:newRecord", populated);
              io.to(`user:${targetUserId.toString()}`).emit("call:newRecord", populated);
            }
          }

          // Broadcast Call message into Chat
          createAndBroadcastCallMessage({
            conversationId: callInfo.conversationId,
            callerId: callInfo.callerId,
            receiverId: callInfo.receiverId,
            callType: callInfo.callType,
            status: callInfo.startTime ? "completed" : "missed",
            duration,
            isGroupCall: false,
          });

          activeCalls.delete(callKey);
        }

        io.to(`user:${targetUserId.toString()}`).emit("call:ended", {
          endedBy: socket.user._id,
        });

        console.log(`Call ended by ${socket.user.name} for ${targetUserId}`);
      } catch (err) {
        console.error("Call end error:", err);
      }
    });

    // Relay WebRTC Signals (Offer, Answer, ICE candidates)
    socket.on("call:signal", (data) => {
      const { targetUserId, signal } = data;
      if (!targetUserId || !signal) return;

      io.to(`user:${targetUserId.toString()}`).emit("call:signal", {
        senderId: socket.user._id.toString(),
        signal,
      });
    });

    // ==============================
    // GROUP WEBRTC CALL SIGNALING
    // ==============================

    // Initiate or Start Group Call
    socket.on("groupCall:initiate", async (data) => {
      try {
        const { conversationId, callType = "video" } = data;
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId).populate(
          "participants",
          "name phone profilePicture isOnline"
        );
        if (!conversation || !conversation.isGroup) {
          return socket.emit("groupCall:error", {
            message: "Group conversation not found",
          });
        }

        // Check if user is an active participant (has not left)
        const userRecord = conversation.participantJoinedAt?.find(
          (p) => p.user?.toString() === userId.toString()
        );
        if (userRecord && userRecord.leftAt) {
          return socket.emit("groupCall:error", {
            message: "You are no longer in this group",
          });
        }

        let groupCall = activeGroupCalls.get(conversationId.toString());

        if (!groupCall) {
          // Create Call document in DB
          let callDocId = null;
          try {
            const callDoc = await Call.create({
              caller: socket.user._id,
              isGroupCall: true,
              groupParticipants: [socket.user._id],
              callType,
              status: "completed",
              duration: 0,
              conversation: conversation._id,
            });
            callDocId = callDoc._id;
          } catch (e) {
            console.error("Create group call DB record error:", e);
          }

          groupCall = {
            conversationId: conversationId.toString(),
            groupName: conversation.groupName,
            groupAvatar: conversation.groupAvatar,
            callType,
            caller: {
              _id: socket.user._id,
              name: socket.user.name,
              profilePicture: socket.user.profilePicture,
              phone: socket.user.phone,
            },
            participants: new Map(),
            startedAt: Date.now(),
            callDocId,
          };

          activeGroupCalls.set(conversationId.toString(), groupCall);
        }

        const callerInfo = {
          _id: socket.user._id,
          name: socket.user.name,
          profilePicture: socket.user.profilePicture,
          phone: socket.user.phone,
        };

        // Add caller to participants
        groupCall.participants.set(userId.toString(), callerInfo);

        // Notify caller that call is initialized
        socket.emit("groupCall:started", {
          conversationId: conversationId.toString(),
          group: {
            _id: conversation._id,
            name: conversation.groupName,
            profilePicture: conversation.groupAvatar,
            isGroup: true,
          },
          callType,
          participants: Array.from(groupCall.participants.values()),
        });

        // Send incoming call alert to all other group participants
        conversation.participants.forEach((p) => {
          const pId = (p._id || p).toString();
          if (pId !== userId.toString() && !groupCall.participants.has(pId)) {
            io.to(`user:${pId}`).emit("groupCall:incoming", {
              caller: callerInfo,
              group: {
                _id: conversation._id,
                name: conversation.groupName,
                profilePicture: conversation.groupAvatar,
                isGroup: true,
              },
              callType,
              conversationId: conversationId.toString(),
            });
          }
        });

        console.log(
          `Group call initiated by ${socket.user.name} in group "${conversation.groupName}" (${callType})`
        );
      } catch (err) {
        console.error("Group call initiate error:", err);
      }
    });

    // Join Group Call
    socket.on("groupCall:join", async (data) => {
      try {
        const { conversationId, callType = "video" } = data;
        if (!conversationId) return;

        let groupCall = activeGroupCalls.get(conversationId.toString());

        // If no active call, auto-create it
        if (!groupCall) {
          const conversation = await Conversation.findById(conversationId);
          if (!conversation || !conversation.isGroup) return;

          let callDocId = null;
          try {
            const callDoc = await Call.create({
              caller: socket.user._id,
              isGroupCall: true,
              groupParticipants: [socket.user._id],
              callType,
              status: "completed",
              duration: 0,
              conversation: conversation._id,
            });
            callDocId = callDoc._id;
          } catch (e) {
            console.error("Create group call DB record error:", e);
          }

          groupCall = {
            conversationId: conversationId.toString(),
            groupName: conversation.groupName,
            groupAvatar: conversation.groupAvatar,
            callType,
            caller: {
              _id: socket.user._id,
              name: socket.user.name,
              profilePicture: socket.user.profilePicture,
              phone: socket.user.phone,
            },
            participants: new Map(),
            startedAt: Date.now(),
            callDocId,
          };

          activeGroupCalls.set(conversationId.toString(), groupCall);
        }

        const userInfo = {
          _id: socket.user._id,
          name: socket.user.name,
          profilePicture: socket.user.profilePicture,
          phone: socket.user.phone,
        };

        const existingParticipants = Array.from(
          groupCall.participants.values()
        ).filter((p) => p._id.toString() !== userId.toString());

        groupCall.participants.set(userId.toString(), userInfo);

        if (groupCall.callDocId) {
          try {
            await Call.findByIdAndUpdate(groupCall.callDocId, {
              $addToSet: { groupParticipants: socket.user._id },
            });
          } catch (e) {
            console.error("Update group call participants DB error:", e);
          }
        }

        // Send existing participants list to the joining user
        socket.emit("groupCall:joined", {
          conversationId: conversationId.toString(),
          group: {
            _id: conversationId,
            name: groupCall.groupName,
            profilePicture: groupCall.groupAvatar,
            isGroup: true,
          },
          callType: groupCall.callType,
          existingParticipants,
        });

        // Notify each existing participant about the new participant
        existingParticipants.forEach((p) => {
          io.to(`user:${p._id.toString()}`).emit("groupCall:userJoined", {
            conversationId: conversationId.toString(),
            user: userInfo,
          });
        });

        console.log(
          `User ${socket.user.name} joined group call in "${groupCall.groupName}"`
        );
      } catch (err) {
        console.error("Group call join error:", err);
      }
    });

    // Relay Group WebRTC Signals (Offer, Answer, ICE Candidates)
    socket.on("groupCall:signal", (data) => {
      const { targetUserId, conversationId, signal } = data;
      if (!targetUserId || !signal) return;

      io.to(`user:${targetUserId.toString()}`).emit("groupCall:signal", {
        senderId: socket.user._id.toString(),
        senderUser: {
          _id: socket.user._id,
          name: socket.user.name,
          profilePicture: socket.user.profilePicture,
          phone: socket.user.phone,
        },
        conversationId,
        signal,
      });
    });

    // Leave Group Call
    socket.on("groupCall:leave", async (data) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) return;

        const groupCall = activeGroupCalls.get(conversationId.toString());
        if (groupCall) {
          groupCall.participants.delete(userId.toString());

          // Notify other participants
          groupCall.participants.forEach((p) => {
            io.to(`user:${p._id.toString()}`).emit("groupCall:userLeft", {
              conversationId: conversationId.toString(),
              userId: userId.toString(),
            });
          });

          // If no one is left in the group call, close it
          if (groupCall.participants.size === 0) {
            const duration = Math.max(
              1,
              Math.floor((Date.now() - groupCall.startedAt) / 1000)
            );
            if (groupCall.callDocId) {
              try {
                await Call.findByIdAndUpdate(groupCall.callDocId, {
                  duration,
                  status: "completed",
                });
              } catch (e) {
                console.error("Save group call final duration error:", e);
              }
            }

            // Create Group Call message in chat
            createAndBroadcastCallMessage({
              conversationId: groupCall.conversationId,
              callerId: groupCall.caller._id,
              callType: groupCall.callType,
              status: "completed",
              duration,
              isGroupCall: true,
            });

            activeGroupCalls.delete(conversationId.toString());
          }
        }
      } catch (err) {
        console.error("Group call leave error:", err);
      }
    });

    // ==============================
    // DISCONNECT
    // ==============================

    socket.on("disconnect", async () => {

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `Socket disconnected: ${socket.user.name} (${userId}) [${socket.id}]`
        );
      }

      // Clean up user from any active group calls
      for (const [convId, groupCall] of activeGroupCalls.entries()) {
        if (groupCall.participants.has(userId.toString())) {
          groupCall.participants.delete(userId.toString());

          groupCall.participants.forEach((p) => {
            io.to(`user:${p._id.toString()}`).emit("groupCall:userLeft", {
              conversationId: convId,
              userId: userId.toString(),
            });
          });

          if (groupCall.participants.size === 0) {
            const duration = Math.max(
              1,
              Math.floor((Date.now() - groupCall.startedAt) / 1000)
            );
            if (groupCall.callDocId) {
              try {
                await Call.findByIdAndUpdate(groupCall.callDocId, {
                  duration,
                  status: "completed",
                });
              } catch (e) {
                console.error("Save group call final duration error:", e);
              }
            }

            // Create Group Call message in chat
            createAndBroadcastCallMessage({
              conversationId: groupCall.conversationId,
              callerId: groupCall.caller._id,
              callType: groupCall.callType,
              status: "completed",
              duration,
              isGroupCall: true,
            });

            activeGroupCalls.delete(convId);
          }
        }
      }

      // ==============================
      // OFFLINE HANDLER (SHARED BY DISCONNECT & TAB CLOSE EVENT)
      // ==============================
      const pruneAndMarkOffline = async () => {
        const userSockets = onlineUsers.get(userId);
        let hasAliveSockets = false;

        if (userSockets) {
          userSockets.delete(socket.id);
          for (const sId of Array.from(userSockets)) {
            if (io.sockets?.sockets?.has(sId)) {
              hasAliveSockets = true;
            } else {
              userSockets.delete(sId); // Prune ghost / dead socket
            }
          }
        }

        if (!hasAliveSockets) {
          onlineUsers.delete(userId);

          const lastSeen = new Date();

          await User.findByIdAndUpdate(
            userId,
            {
              isOnline: false,
              lastSeen,
            }
          );

          io.emit(
            "user:offline",
            {
              userId,
              lastSeen,
            }
          );

          console.log(
            `User ${socket.user.name} is now offline (all sockets disconnected)`
          );
        } else {
          console.log(
            `User ${socket.user.name} still has active connection(s)`
          );
        }
      };

      socket.on("user:going_offline", pruneAndMarkOffline);
      socket.on("disconnect", pruneAndMarkOffline);
    });
  });
};

export const rejectCallFromPush = async ({ callerId, receiverId, callId, reason = "declined" }) => {
  if (!callerId) return;
  const u1 = callerId.toString();
  const u2 = (receiverId || "").toString();
  const callKey = [u1, u2].sort().join(":");
  const callInfo = activeCalls.get(callKey);
  if (callInfo) {
    if (callInfo.timeoutId) clearTimeout(callInfo.timeoutId);
    activeCalls.delete(callKey);
  }
  if (callId) {
    try {
      await Call.findByIdAndUpdate(callId, { status: "rejected" });
    } catch (e) {}
  }
  if (ioInstance) {
    ioInstance.to(`user:${callerId.toString()}`).emit("call:rejected", {
      callerId,
      rejectedBy: receiverId,
      reason,
      callId,
    });
  }
};

export {
  setupSocket,
  onlineUsers,
  isUserOnline,
};