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

        // Validate text
        if (!text || !text.trim()) {
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

        // Find receiver
        const receiverId =
          conversation.participants.find(
            (participant) =>
              participant.toString() !==
              userId
          );

        if (!receiverId) {
          return socket.emit(
            "message:error",
            {
              message:
                "Receiver not found",
            }
          );
        }

        // Check receiver exists
        const receiver =
          await User.findById(receiverId);

        if (!receiver) {
          return socket.emit(
            "message:error",
            {
              message:
                "Receiver not found",
            }
          );
        }

        // Check if receiver is online for instant delivery
        const receiverIsOnline = isUserOnline(
          receiverId.toString()
        );

        // Save message
        const message =
          await Message.create({
            conversation: conversationId,
            sender: socket.user._id,
            receiver: receiverId,
            text: text.trim(),
            messageType: "text",
            isDelivered: receiverIsOnline,
            isSeen: false,
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
              "name phone profilePic"
            )
            .populate(
              "receiver",
              "name phone profilePic"
            );

        // ==============================
        // SEND TO SENDER (all devices)
        // ==============================

        io.to(`user:${userId}`).emit(
          "newMessage",
          populatedMessage
        );

        // ==============================
        // SEND TO RECEIVER (all devices)
        // ==============================

        io.to(
          `user:${receiverId.toString()}`
        ).emit(
          "newMessage",
          populatedMessage
        );

        // ==============================
        // NOTIFY SENDER OF DELIVERY
        // ==============================
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

        console.log(
          `Message sent: ${userId} -> ${receiverId} (delivered: ${receiverIsOnline})`
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

        console.log(
          `${unseenMessages.length} messages marked as seen in conversation ${conversationId}`
        );
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

    socket.on("typing:start", (data) => {
      const { conversationId, receiverId } = data;

      if (!conversationId || !receiverId) return;

      // Send to all receiver's devices
      io.to(`user:${receiverId}`).emit(
        "typing:start",
        {
          conversationId,
          userId,
          userName: socket.user.name,
        }
      );
    });

    socket.on("typing:stop", (data) => {
      const { conversationId, receiverId } = data;

      if (!conversationId || !receiverId) return;

      // Send to all receiver's devices
      io.to(`user:${receiverId}`).emit(
        "typing:stop",
        {
          conversationId,
          userId,
        }
      );
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