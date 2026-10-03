import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

// Map<userId, Set<socketId>> — supports multiple devices per user
const onlineUsers = new Map();

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

/**
 * Check if a user has any active socket connections
 */
const isUserOnline = (userId) => {
  const sockets = onlineUsers.get(userId);
  return sockets && sockets.size > 0;
};

const setupSocket = (io) => {
  // ==============================
  // SOCKET AUTHENTICATION
  // ==============================

  io.use(async (socket, next) => {
    try {
      const cookieHeader =
        socket.handshake.headers.cookie;

      const cookies = parseCookies(cookieHeader);

      const accessToken = cookies.accessToken;

      if (!accessToken) {
        return next(
          new Error("Authentication required")
        );
      }

      const decoded = jwt.verify(
        accessToken,
        process.env.JWT_ACCESS_SECRET
      );

      const user = await User.findById(
        decoded.userId
      ).select(
        "_id name phone profilePic isOnline lastSeen"
      );

      if (!user) {
        return next(
          new Error("User not found")
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error(
        "Socket authentication error:",
        error.message
      );

      next(
        new Error("Invalid socket authentication")
      );
    }
  });

  // ==============================
  // CONNECTION
  // ==============================

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    console.log(
      `Socket connected: ${socket.user.name} (${userId}) [${socket.id}]`
    );

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
    // Mark all undelivered messages sent TO this user as delivered
    try {
      const undeliveredMessages = await Message.find({
        receiver: userId,
        isDelivered: false,
      });

      if (undeliveredMessages.length > 0) {
        const messageIds = undeliveredMessages.map(
          (msg) => msg._id
        );

        await Message.updateMany(
          { _id: { $in: messageIds } },
          { isDelivered: true }
        );

        // Group by sender and notify each sender
        const senderGroups = {};
        for (const msg of undeliveredMessages) {
          const senderId = msg.sender.toString();
          if (!senderGroups[senderId]) {
            senderGroups[senderId] = [];
          }
          senderGroups[senderId].push({
            messageId: msg._id.toString(),
            conversationId: msg.conversation.toString(),
          });
        }

        for (const [senderId, deliveredMsgs] of Object.entries(senderGroups)) {
          io.to(`user:${senderId}`).emit(
            "message:delivered",
            {
              messages: deliveredMsgs,
            }
          );
        }

        console.log(
          `Delivered ${messageIds.length} pending messages for ${socket.user.name}`
        );
      }
    } catch (error) {
      console.error(
        "Error delivering pending messages:",
        error
      );
    }

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

          receiverIsOnline = isUserOnline(receiverId.toString());
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
            isDelivered: !conversation.isGroup ? receiverIsOnline : false,
            isSeen: false,
            isForwarded: Boolean(isForwarded),
          });

        // Update conversation
        conversation.lastMessage =
          message._id;

        conversation.lastMessageAt =
          new Date();

        await conversation.save();

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
        if (conversation.isGroup) {
          conversation.participants.forEach((pId) => {
            io.to(`user:${pId.toString()}`).emit(
              "newMessage",
              populatedMessage
            );
          });
        } else {
          io.to(`user:${userId}`).emit(
            "newMessage",
            populatedMessage
          );

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

        // Find all unseen messages in this conversation sent TO current user
        const unseenMessages = await Message.find({
          conversation: conversationId,
          receiver: userId,
          isSeen: false,
        });

        if (unseenMessages.length === 0) return;

        const messageIds = unseenMessages.map(
          (msg) => msg._id
        );

        const seenAt = new Date();

        // Update messages
        await Message.updateMany(
          { _id: { $in: messageIds } },
          {
            isSeen: true,
            isDelivered: true,
            seenAt,
          }
        );

        // Notify sender(s) that messages have been seen
        const senderGroups = {};
        for (const msg of unseenMessages) {
          const senderId = msg.sender.toString();
          if (!senderGroups[senderId]) {
            senderGroups[senderId] = [];
          }
          senderGroups[senderId].push({
            messageId: msg._id.toString(),
            conversationId: conversationId,
          });
        }

        for (const [senderId, seenMsgs] of Object.entries(senderGroups)) {
          io.to(`user:${senderId}`).emit(
            "message:seen",
            {
              conversationId,
              messages: seenMsgs,
              seenAt,
              seenBy: userId,
            }
          );
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

    // ==============================
    // WEBRTC CALL SIGNALING
    // ==============================

    // Initiate Call
    socket.on("call:initiate", (data) => {
      const { receiverId, callType = "video", conversationId } = data;

      if (!receiverId) return;

      const receiverOnline = isUserOnline(receiverId.toString());

      if (!receiverOnline) {
        return socket.emit("call:userOffline", {
          receiverId,
          message: "User is currently offline",
        });
      }

      // Send incoming call alert to receiver
      io.to(`user:${receiverId.toString()}`).emit("call:incoming", {
        caller: {
          _id: socket.user._id,
          name: socket.user.name,
          profilePicture: socket.user.profilePicture,
          phone: socket.user.phone,
        },
        callType,
        conversationId,
      });

      console.log(`Call initiated: ${socket.user.name} -> ${receiverId} (${callType})`);
    });

    // Accept Call
    socket.on("call:accept", (data) => {
      const { callerId } = data;
      if (!callerId) return;

      io.to(`user:${callerId.toString()}`).emit("call:accepted", {
        acceptedBy: {
          _id: socket.user._id,
          name: socket.user.name,
          profilePicture: socket.user.profilePicture,
        },
      });

      console.log(`Call accepted by ${socket.user.name} for ${callerId}`);
    });

    // Reject Call
    socket.on("call:reject", (data) => {
      const { callerId, reason = "declined" } = data;
      if (!callerId) return;

      io.to(`user:${callerId.toString()}`).emit("call:rejected", {
        callerId,
        rejectedBy: socket.user._id,
        reason,
      });

      console.log(`Call rejected by ${socket.user.name} for ${callerId} (${reason})`);
    });

    // End / Hangup Call
    socket.on("call:end", (data) => {
      const { targetUserId } = data;
      if (!targetUserId) return;

      io.to(`user:${targetUserId.toString()}`).emit("call:ended", {
        endedBy: socket.user._id,
      });

      console.log(`Call ended by ${socket.user.name} for ${targetUserId}`);
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
    // DISCONNECT
    // ==============================

    socket.on("disconnect", async () => {
      console.log(
        `Socket disconnected: ${socket.user.name} (${userId}) [${socket.id}]`
      );

      // Remove this specific socket from the user's set
      const userSockets = onlineUsers.get(userId);

      if (userSockets) {
        userSockets.delete(socket.id);

        // Only mark offline if NO sockets remain (all devices disconnected)
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          const lastSeen = new Date();

          await User.findByIdAndUpdate(
            userId,
            {
              isOnline: false,
              lastSeen,
            }
          );

          socket.broadcast.emit(
            "user:offline",
            {
              userId,
              lastSeen,
            }
          );

          console.log(
            `User ${socket.user.name} is now fully offline (all devices disconnected)`
          );
        } else {
          console.log(
            `User ${socket.user.name} still has ${userSockets.size} active connection(s)`
          );
        }
      }
    });
  });
};

export {
  setupSocket,
  onlineUsers,
  isUserOnline,
};