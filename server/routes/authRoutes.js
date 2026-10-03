import { Router } from 'express';
import { registerUser, loginUser, logoutUser, refreshAccessToken } from '../controllers/authController.js';
import protect from '../middleware/authMiddleware.js';

const authRouter = Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/logout", protect, logoutUser);

authRouter.get("/me", protect, (req, res) => {
    res.status(200).json({
        message: "get user data",
        success: true,
        error: false,
        user: req.user,
    });
});

export default authRouter;