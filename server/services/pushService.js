import "dotenv/config";
import webpush from "web-push";
import mongoose from "mongoose";
import PushSubscription from "../models/PushSubscription.js";

let vapidConfigured = false;

// Ensure VAPID is initialized with latest environment variables
export const ensureVapidConfigured = () => {
    if (vapidConfigured) return true;

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@chatapp.local";

    if (publicKey && privateKey) {
        try {
            webpush.setVapidDetails(subject, publicKey, privateKey);
            vapidConfigured = true;
            console.log("[PushService] VAPID configured successfully.");
            return true;
        } catch (err) {
            console.error("[PushService] Error configuring VAPID details:", err.message);
            return false;
        }
    } else {
        console.warn("[PushService] VAPID keys not configured in environment.");
        return false;
    }
};

ensureVapidConfigured();

/**
 * Sanitize avatar URL to prevent RFC 8291 4096-byte payload overflow.
 * Base64 data URLs must NEVER be passed into push notification payloads!
 */
export const sanitizeAvatarUrl = (avatar) => {
    if (!avatar || typeof avatar !== "string") return "";
    // Only accept short HTTP/HTTPS URLs (under 250 chars)
    if ((avatar.startsWith("http://") || avatar.startsWith("https://")) && avatar.length < 250) {
        return avatar;
    }
    // Strip large data:image/... base64 URLs so payload stays < 500 bytes
    return "";
};

/**
 * Send a Web Push notification to all active devices/subscriptions of a user
 */
export const sendPushToUser = async (userId, payload, pushOptions = {}) => {
    if (!userId) return { success: false, sentCount: 0 };
    ensureVapidConfigured();

    try {
        const idStr = (userId?._id || userId).toString();
        let queryCondition = { userId: idStr };
        if (mongoose.Types.ObjectId.isValid(idStr)) {
            queryCondition = {
                $or: [{ userId: idStr }, { userId: new mongoose.Types.ObjectId(idStr) }],
            };
        }

        const subscriptions = await PushSubscription.find(queryCondition);
        if (!subscriptions || subscriptions.length === 0) {
            return { success: true, sentCount: 0, reason: "No subscriptions" };
        }

        // Defensively sanitize payload to stay strictly under RFC 8291 4096-byte limit
        let safePayload = payload;
        if (typeof payload === "object" && payload !== null) {
            safePayload = { ...payload };
            if (safePayload.senderAvatar) {
                safePayload.senderAvatar = sanitizeAvatarUrl(safePayload.senderAvatar);
            }
            if (safePayload.callerAvatar) {
                safePayload.callerAvatar = sanitizeAvatarUrl(safePayload.callerAvatar);
            }
            if (safePayload.body && typeof safePayload.body === "string" && safePayload.body.length > 200) {
                safePayload.body = safePayload.body.substring(0, 200) + "...";
            }
        }

        let payloadString = typeof safePayload === "string" ? safePayload : JSON.stringify(safePayload);
        if (payloadString.length > 3800) {
            console.warn(`[PushService] Trimming oversized push payload (${payloadString.length} bytes)`);
            payloadString = JSON.stringify({
                type: safePayload?.type || "MESSAGE",
                senderName: safePayload?.senderName || "ChatApp",
                body: "New message received",
                timestamp: new Date().toISOString(),
            });
        }
        const expiredEndpoints = [];

        const defaultOptions = {
            TTL: 60 * 60, // 1 hour default TTL
            urgency: "high",
            ...pushOptions,
        };

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.keys.p256dh,
                        auth: sub.keys.auth,
                    },
                };

                try {
                    await webpush.sendNotification(pushConfig, payloadString, defaultOptions);
                    await PushSubscription.updateOne(
                        { _id: sub._id },
                        { $set: { lastUsedAt: new Date() } }
                    );
                    return { success: true, endpoint: sub.endpoint };
                } catch (err) {
                    const status = err.statusCode || err.status;
                    if (status === 404 || status === 410) {
                        // 410 Gone / 404 Not Found: subscription is expired or deregistered
                        expiredEndpoints.push(sub.endpoint);
                    }
                    throw err;
                }
            })
        );

        // Clean up expired or invalid subscriptions automatically
        if (expiredEndpoints.length > 0) {
            await PushSubscription.deleteMany({ endpoint: { $in: expiredEndpoints } });
            console.log(`[PushService] Cleaned up ${expiredEndpoints.length} expired push subscriptions.`);
        }

        const successfulCount = results.filter((r) => r.status === "fulfilled").length;
        return { success: true, sentCount: successfulCount, total: subscriptions.length };
    } catch (err) {
        console.error(`[PushService] Failed to send push to user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send Web Push to multiple users (e.g. group chat participants)
 */
export const sendPushToMultipleUsers = async (userIds, payload, pushOptions = {}) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    return Promise.allSettled(
        userIds.map((uid) => sendPushToUser(uid, payload, pushOptions))
    );
};

/**
 * Helper to dispatch Message Push Notification
 */
export const sendMessagePush = async ({
    sender,
    conversation,
    message,
    recipientIds,
}) => {
    if (!recipientIds || recipientIds.length === 0) return;

    // Generate safe preview text
    let preview = "";
    if (message.messageType === "image") {
        preview = "📷 Photo";
    } else if (message.messageType === "video") {
        preview = "🎥 Video";
    } else if (message.messageType === "audio") {
        preview = "🎤 Voice message";
    } else if (message.messageType === "file" || message.messageType === "document") {
        preview = message.fileName ? `📄 ${message.fileName}` : "📄 Document";
    } else if (message.text) {
        preview = message.text.length > 80 ? `${message.text.substring(0, 80)}...` : message.text;
    } else {
        preview = "New message";
    }

    const payload = {
        type: "MESSAGE",
        conversationId: (conversation._id || conversation).toString(),
        conversationName: conversation.isGroup
            ? (conversation.groupName || conversation.name || "Group")
            : sender?.name || "ChatApp",
        isGroup: Boolean(conversation.isGroup),
        senderId: (sender._id || sender).toString(),
        senderName: sender?.name || "Someone",
        senderAvatar: sanitizeAvatarUrl(sender?.profilePicture),
        messageId: message._id ? message._id.toString() : "",
        body: preview,
        timestamp: message.createdAt || new Date().toISOString(),
        serverUrl: process.env.BACKEND_URL || "http://localhost:5000",
    };

    return sendPushToMultipleUsers(recipientIds, payload, {
        TTL: 24 * 60 * 60, // 24 hours
        urgency: "high",
    });
};

/**
 * Helper to dispatch Incoming Call Push Notification
 */
export const sendCallPush = async ({
    caller,
    receiverId,
    callType = "video",
    callId = null,
    conversationId = null,
}) => {
    const payload = {
        type: callType === "video" ? "VIDEO_CALL" : "AUDIO_CALL",
        callType,
        callId: callId ? callId.toString() : "",
        callerId: (caller._id || caller).toString(),
        callerName: caller?.name || "Caller",
        callerAvatar: sanitizeAvatarUrl(caller?.profilePicture),
        callerPhone: caller?.phone || "",
        conversationId: conversationId ? conversationId.toString() : "",
        timestamp: Date.now(),
        serverUrl: process.env.BACKEND_URL || "http://localhost:5000",
    };

    return sendPushToUser(receiverId, payload, {
        TTL: 45,
        urgency: "high",
    });
};
