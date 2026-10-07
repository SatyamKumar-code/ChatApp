import PushSubscription from "../models/PushSubscription.js";
import Call from "../models/Call.js";
import Message from "../models/Message.js";
import { sendPushToUser, sanitizeAvatarUrl } from "../services/pushService.js";

/**
 * Get Public VAPID Key
 */
export const getVapidPublicKey = async (req, res) => {
    try {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        if (!publicKey) {
            return res.status(500).json({
                success: false,
                message: "VAPID public key not configured on server",
            });
        }
        res.status(200).json({
            success: true,
            publicKey,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Register / Update a Push Subscription for the authenticated user
 */
export const subscribeUser = async (req, res) => {
    try {
        const { endpoint, keys, userAgent, deviceInfo } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({
                success: false,
                message: "Invalid push subscription object. Endpoint and keys are required.",
            });
        }

        const subscription = await PushSubscription.findOneAndUpdate(
            { endpoint },
            {
                userId: req.user._id,
                endpoint,
                keys: {
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                },
                userAgent: userAgent || req.headers["user-agent"] || "",
                deviceInfo: deviceInfo || "",
                lastUsedAt: new Date(),
            },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: "Push subscription saved successfully",
            subscriptionId: subscription._id,
        });
    } catch (err) {
        console.error("Save push subscription error:", err);
        res.status(500).json({ success: false, message: "Failed to save push subscription" });
    }
};

/**
 * Unsubscribe / Remove a Push Subscription for the authenticated user
 */
export const unsubscribeUser = async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (endpoint) {
            await PushSubscription.findOneAndDelete({
                endpoint,
                userId: req.user._id,
            });
        } else {
            // If no endpoint specified, optionally remove all for this user
            await PushSubscription.deleteMany({ userId: req.user._id });
        }

        res.status(200).json({
            success: true,
            message: "Push subscription removed successfully",
        });
    } catch (err) {
        console.error("Remove push subscription error:", err);
        res.status(500).json({ success: false, message: "Failed to unsubscribe" });
    }
};

/**
 * Get Subscription status for current user
 */
export const getSubscriptionStatus = async (req, res) => {
    try {
        const count = await PushSubscription.countDocuments({ userId: req.user._id });
        res.status(200).json({
            success: true,
            isSubscribed: count > 0,
            activeDeviceCount: count,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Send a Test Notification to verify push delivery
 */
export const sendTestPush = async (req, res) => {
    try {
        const result = await sendPushToUser(req.user._id, {
            type: "MESSAGE",
            conversationId: "",
            conversationName: "ChatApp System",
            senderId: req.user._id.toString(),
            senderName: "ChatApp Notification Test",
            senderAvatar: sanitizeAvatarUrl(req.user.profilePicture),
            body: "Push Notifications are working properly on your device!",
            timestamp: new Date().toISOString(),
        });

        res.status(200).json({
            success: true,
            message: "Test push sent",
            details: result,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Handle call rejection initiated directly from the Service Worker background notification
 */
export const handleCallRejectFromPush = async (req, res) => {
    try {
        const { callerId, callId } = req.body;
        const rejectorId = req.user?._id;

        const { rejectCallFromPush } = await import("../socket/socketServer.js");
        if (rejectCallFromPush) {
            await rejectCallFromPush({
                callerId,
                receiverId: rejectorId,
                callId,
                reason: "declined",
            });
        }

        res.status(200).json({
            success: true,
            message: "Call declined signal sent",
        });
    } catch (err) {
        console.error("Handle call reject error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Handle delivery acknowledgement when Service Worker receives a Web Push notification
 */
export const handlePushDeliveryAck = async (req, res) => {
    try {
        const { messageId, conversationId } = req.body;
        if (!messageId) {
            return res.status(400).json({ success: false, message: "messageId required" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!message.isDelivered && !message.isSeen) {
            message.isDelivered = true;
            if (!message.deliveredAt) {
                message.deliveredAt = new Date();
            }
            await message.save();

            const io = req.app.get("io");
            if (io && message.sender) {
                const senderId = (message.sender._id || message.sender).toString();
                io.to(`user:${senderId}`).emit("message:delivered", {
                    messages: [
                        {
                            messageId: message._id.toString(),
                            conversationId: (message.conversation?._id || message.conversation || conversationId).toString(),
                        },
                    ],
                });
                console.log(`[PushDeliveryAck] Double tick emitted to sender ${senderId} for message ${messageId}`);
            }
        }

        return res.status(200).json({ success: true, message: "Delivery acknowledged" });
    } catch (err) {
        console.error("[PushDeliveryAck] Error acknowledging delivery:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
