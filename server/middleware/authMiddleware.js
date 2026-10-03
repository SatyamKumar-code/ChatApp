import jwt from 'jsonwebtoken';
import UserModel from '../models/User.js';

const protect = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                message: "Access token not found",
                success: false,
                error: true
            });
        }

        // Verify access token
        const decoded = jwt.verify(
            accessToken,
            process.env.JWT_ACCESS_SECRET
        );

        // find user by id
        const user = await UserModel.findById(decoded.userId).select("-password -refreshToken");

        if (!user) {
            return res.status(401).json({
                message: "User not found",
                success: false,
                error: true
            });
        }

        // Attach user to request object
        req.user = user;

        next();

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Access token expired",
                success: false,
                error: true
            });
        }

        return res.status(401).json({
            message: "Invalid access token",
            success: false,
            error: true
        });
    }
}

export default protect;