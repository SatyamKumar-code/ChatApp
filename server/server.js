import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import dns from "node:dns";

// Routes
import authRouter from './routes/authRoutes.js';
import contactRouter from './routes/contactRoutes.js';
import conversationRouter from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import callRoutes from './routes/callRoutes.js';

import { Server } from 'socket.io';
import { setupSocket } from './socket/socketServer.js';
import User from './models/User.js';

dns.setServers([
    "8.8.8.8",
    "8.8.4.4"
])

dotenv.config();

const app = express();

// HTTP server
const server = http.createServer(app);

// Socket.IO server with fast ping-pong to detect disconnected tabs quickly
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true,
    },
    pingInterval: 3000,
    pingTimeout: 2000,
});

app.set("io", io);

// Socket setup
setupSocket(io);

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/messages", messageRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/calls", callRoutes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Chat server is running"
    })
})

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    // Reset all users isOnline status to false on server boot
    try {
        await User.updateMany({ isOnline: true }, { isOnline: false, lastSeen: new Date() });
        console.log("Reset all users online status to offline on startup");
    } catch (e) {
        console.error("Failed to reset online status on startup:", e);
    }

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
};

startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
});