import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import dns from "node:dns";

import authRouter from './routes/authRoutes.js';

dns.setServers([
    "8.8.8.8",
    "8.8.4.4"
])

dotenv.config();

const app = express();

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Chat server is running"
    })
})

const PORT = process.env.PORT;

connectDB().then(
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
)