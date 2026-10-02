import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';


const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
}

const registerUser = async (req, res) => {
    try {
        const { name, phone, password } = req.body;

        // 1. Required fields
        if (!name || !phone || !password) {
            return res.status(400).json({
                message: "Please fill in all required fields",
                success: false,
                error: true
            });
        }
        // 2. Password validation
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long",
                success: false,
                error: true
            });
        }

        // 3. Phone validation
        const phoneRegex = /^[6-9]\d{9}$/;

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                message: "Please enter a valid 10-digit phone number",
                success: false,
                error: true
            });
        }

        // 4. Check existing user
        const existingUser = await UserModel.findOne({ phone });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this phone number",
                success: false,
                error: true
            });
        }


        // 5. Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // 6. Create new user
        const user = new UserModel({
            name,
            phone,
            password: hashedPassword
        });

        // 7. Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // 8. save refresh token
        user.refreshToken = refreshToken;
        await user.save();

        // 9. Access token cookie
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });


        // 10. Refresh token cookie
        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // 11. Response
        res.status(201).json({
            message: "User registered successfully",
            success: true,
            error: false,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                profilePicture: user.profilePicture,
                about: user.about,
            },
        });

    } catch (error) {
        console.error("Register error:", error.message);

        res.status(500).json({
            message: "server error",
            success: false,
            error: true
        })
    }
}

const loginUser = async (req, res) => {
    try {
        const { phone, password } = req.body;

        // 1. Required fields
        if (!phone || !password) {
            return res.status(400).json({
                message: "Please fill in all required fields",
                success: false,
                error: true
            });
        }

        // 2. Check if user exists
        const user = await UserModel.findOne({ phone });

        if (!user) {
            return res.status(401).json({
                message: "Invalid phone number or password",
                success: false,
                error: true
            });
        }

        // 3. Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid phone number or password",
                success: false,
                error: true
            });
        }

        // 4. Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // 5. Save refresh token
        user.refreshToken = refreshToken;

        user.isOnline = true;
        user.lastSeen = null;
        await user.save();

        // 6. Access token cookie
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        // 7. Refresh token cookie
        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // 8. Response
        res.status(200).json({
            message: "User logged in successfully",
            success: true,
            error: false,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                profilePicture: user.profilePicture,
                about: user.about,
                isOnline: user.isOnline,
            },
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "server error",
            success: false,
            error: true
        })
    }
}

const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                message: "Refresh token not found",
                success: false,
                error: true
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );

        if (!decoded || !decoded.userId) {
            return res.status(401).json({
                message: "Invalid refresh token",
                success: false,
                error: true
            });
        }

        // find user by id
        const user = await UserModel.findById(decoded.userId);

        if (!user ) {
            return res.status(401).json({
                message: "User not found",
                success: false,
                error: true
            });
        }

        // Check if refresh token matches stired refresh token
        if (user.refreshToken !== refreshToken) {
            return res.status(401).json({
                message: "Invalid refresh token",
                success: false,
                error: true
            });
        }

        // Generate new access token
        const newAccessToken = generateAccessToken(user._id);

        // set new access token cookie
        res.cookie("accessToken", newAccessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000 // 15 minutes
        });

        res.status(200).json({
            message: "Access token refreshed",
            success: true,
            error: false,
        });


    } catch (error) {
        console.error("Refresh token error:", error.message);
        res.status(500).json({
            message: "server error",
            success: false,
            error: true
        })
    }
}

const logoutUser = async (req, res) => {
    try {
        const user = res.user;

        if (user) {
            user.refreshToken = null;
            user.isOnline = false;
            user.lastSeen = new Date();
            await user.save();
        }

        // Clear cookies
        res.clearCookie("accessToken", {
            ...cookieOptions,
            maxAge: 0
        });
        res.clearCookie("refreshToken", {
            ...cookieOptions,
            maxAge: 0
        });

        res.status(200).json({
            message: "User logged out successfully",
            success: true,
            error: false
        });

    } catch (error) {
        console.error("Logout error:", error.message);
        res.status(500).json({
            message: "server error",
            success: false,
            error: true
        })
    }
}

export { registerUser, loginUser, refreshAccessToken, logoutUser };