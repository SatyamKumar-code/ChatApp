import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
    getVapidPublicKey,
    subscribeUser,
    unsubscribeUser,
    getSubscriptionStatus,
    sendTestPush,
    handleCallRejectFromPush,
    handlePushDeliveryAck,
} from "../controllers/pushController.js";
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";

const router = express.Router();

// Soft auth helper for background call rejection
const softProtect = async (req, res, next) => {
    try {
        const accessToken =
            req.cookies?.accessToken ||
            req.headers?.authorization?.replace(/^Bearer\s+/i, "");
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
                req.user = await UserModel.findById(decoded.userId).select("-password");
            } catch (e) {
                // Try refresh token fallback
                if (req.cookies?.refreshToken) {
                    try {
                        const rDecoded = jwt.verify(req.cookies.refreshToken, process.env.JWT_REFRESH_SECRET);
                        req.user = await UserModel.findById(rDecoded.userId).select("-password");
                    } catch (re) {}
                }
            }
        }
        next();
    } catch (err) {
        next();
    }
};

router.get("/vapid-public-key", protect, getVapidPublicKey);
router.post("/subscribe", protect, subscribeUser);
router.post("/unsubscribe", protect, unsubscribeUser);
router.get("/status", protect, getSubscriptionStatus);
router.post("/test", protect, sendTestPush);
router.post("/call-reject", softProtect, handleCallRejectFromPush);
router.post("/delivery-ack", softProtect, handlePushDeliveryAck);

export default router;
