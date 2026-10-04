import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';


const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER) ||
    (process.env.CLIENT_URL && process.env.CLIENT_URL.startsWith("https://"));

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
};

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

        // 8. Hash and save refresh token
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        user.refreshToken = hashedRefreshToken;
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

        // 5. Hash and save refresh token
        const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
        user.refreshToken = hashedRefreshToken;

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

        if (!user || !user.refreshToken) {
            return res.status(401).json({
                message: "Invalid refresh token",
                success: false,
                error: true
            });
        }

        // Check if refresh token matches stored hashed refresh token
        const isMatch = user.refreshToken.startsWith("$2")
            ? await bcrypt.compare(refreshToken, user.refreshToken)
            : user.refreshToken === refreshToken;

        if (!isMatch) {
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
            accessToken: newAccessToken,
        });

    } catch (error) {
        console.error("Refresh token error:", error.message);
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Refresh token expired",
                success: false,
                error: true
            });
        }
        return res.status(401).json({
            message: "Invalid refresh token",
            success: false,
            error: true
        });
    }
}

const logoutUser = async (req, res) => {
    try {
        const user = req.user;

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

const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, about, profilePicture } = req.body;

        const updateData = {};
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Name cannot be empty",
                    success: false,
                    error: true
                });
            }
            updateData.name = name.trim();
        }

        if (about !== undefined) {
            updateData.about = about.trim();
        }

        if (profilePicture !== undefined) {
            updateData.profilePicture = profilePicture;
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select("-password -refreshToken");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
                success: false,
                error: true
            });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            success: true,
            error: false,
            user: {
                id: updatedUser._id,
                _id: updatedUser._id,
                name: updatedUser.name,
                phone: updatedUser.phone,
                profilePicture: updatedUser.profilePicture,
                about: updatedUser.about,
                isOnline: updatedUser.isOnline,
            }
        });
    } catch (error) {
        console.error("Update profile error:", error.message);
        res.status(500).json({
            message: error.message || "Failed to update profile",
            success: false,
            error: true
        });
    }
};

const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || !query.trim()) {
            return res.status(200).json({
                success: true,
                error: false,
                users: [],
            });
        }

        const trimmed = query.trim();
        const cleanPhone = trimmed.replace(/\D/g, "");

        const orConditions = [];

        // If phone digits provided
        if (cleanPhone.length >= 3) {
            orConditions.push({ phone: { $regex: cleanPhone, $options: "i" } });
        }

        // If alphanumeric name text provided
        orConditions.push({ name: { $regex: trimmed, $options: "i" } });

        const users = await UserModel.find({
            _id: { $ne: req.user._id },
            $or: orConditions,
        })
            .select("name phone profilePicture about isOnline lastSeen blockedUsers")
            .limit(20);

        const currentUserId = req.user._id.toString();
        const formattedUsers = users.map((u) => {
            const isBlockedByOther = Boolean(
                u.blockedUsers &&
                u.blockedUsers.some(
                    (bId) => (bId?._id || bId).toString() === currentUserId
                )
            );

            return {
                _id: u._id,
                name: u.name,
                phone: u.phone,
                profilePicture: isBlockedByOther ? "" : (u.profilePicture || ""),
                about: isBlockedByOther ? "" : (u.about || ""),
                isOnline: isBlockedByOther ? false : Boolean(u.isOnline),
                lastSeen: isBlockedByOther ? null : u.lastSeen,
                isBlockedByOther,
            };
        });

        return res.status(200).json({
            success: true,
            error: false,
            users: formattedUsers,
        });
    } catch (error) {
        console.error("Search users error:", error.message);
        return res.status(500).json({
            message: "Failed to search users",
            success: false,
            error: true,
        });
    }
};

// Toggle Block User
const toggleBlockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        if (userId.toString() === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself",
            });
        }

        const user = await UserModel.findById(currentUserId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }

        const index = user.blockedUsers.findIndex(
            (id) => (id?._id || id).toString() === userId.toString()
        );

        let isBlocked = false;
        if (index > -1) {
            user.blockedUsers.splice(index, 1);
            isBlocked = false;
        } else {
            user.blockedUsers.push(userId);
            isBlocked = true;
        }

        await user.save();

        res.status(200).json({
            success: true,
            isBlocked,
            blockedUsers: user.blockedUsers,
            message: isBlocked ? "User blocked successfully" : "User unblocked successfully",
        });
    } catch (error) {
        console.error("Toggle block user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update block status",
        });
    }
};

// Get Blocked Users
const getBlockedUsers = async (req, res) => {
    try {
        const user = await UserModel.findById(req.user._id).populate(
            "blockedUsers",
            "name phone profilePicture isOnline lastSeen"
        );

        res.status(200).json({
            success: true,
            blockedUsers: user?.blockedUsers || [],
        });
    } catch (error) {
        console.error("Get blocked users error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get blocked users",
        });
    }
};

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    updateProfile,
    searchUsers,
    toggleBlockUser,
    getBlockedUsers,
};