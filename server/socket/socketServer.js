import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

const setupSocket = (io) => {
  // Socket authentication
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

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    console.log(
      `Socket connected: ${socket.user.name} (${userId})`
    );

    // Every user gets a private room
    socket.join(`user:${userId}`);

    // Store socket ID
    onlineUsers.set(userId, socket.id);

    // Update online status
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
    });

    // Send current user's socket information
    socket.emit("socket:connected", {
      socketId: socket.id,
      userId,
    });

    // Notify others that this user is online
    socket.broadcast.emit("user:online", {
      userId,
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log(
        `Socket disconnected: ${socket.user.name} (${userId})`
      );

      // Only mark offline if this is the
      // user's current socket
      if (onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        socket.broadcast.emit("user:offline", {
          userId,
          lastSeen: new Date(),
        });
      }
    });
  });
};

export { setupSocket, onlineUsers };