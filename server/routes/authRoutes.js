import { Router } from 'express';
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    updateProfile,
    searchUsers,
    toggleBlockUser,
    getBlockedUsers,
    setOffline,
} from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const authRouter = Router();

authRouter.get("/search", protect, searchUsers);
authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/offline", async (req, res, next) => {
    const token = req.cookies?.accessToken || req.headers?.authorization;
    if (token) {
        return protect(req, res, next);
    }
    next();
}, setOffline);
authRouter.put("/profile", protect, updateProfile);

// Block / Unblock user
authRouter.post("/block/:userId", protect, toggleBlockUser);
authRouter.get("/blocked/all", protect, getBlockedUsers);

authRouter.get("/me", protect, (req, res) => {
    res.status(200).json({
        message: "get user data",
        success: true,
        error: false,
        user: req.user,
    });
});

export default authRouter;