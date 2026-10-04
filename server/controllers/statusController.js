import Status from "../models/Status.js";
import User from "../models/User.js";

/**
 * @desc    Create a new status update
 * @route   POST /api/status
 * @access  Private
 */
export const createStatus = async (req, res) => {
    try {
        const { type = "text", text = "", photoUrl = "", gradient } = req.body;

        if (type === "text" && !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Status text cannot be empty",
            });
        }

        if (type === "photo" && !photoUrl) {
            return res.status(400).json({
                success: false,
                message: "Photo is required for photo status",
            });
        }

        const newStatus = await Status.create({
            user: req.user._id,
            type,
            text: text ? text.trim() : "",
            photoUrl: photoUrl || "",
            gradient: gradient || "from-purple-600 to-indigo-700",
            viewers: [],
        });

        const populatedStatus = await Status.findById(newStatus._id)
            .populate("user", "name profilePicture phone isOnline")
            .populate("viewers.user", "name profilePicture phone");

        // Broadcast only to users who have NOT blocked creator and whom creator has NOT blocked
        const io = req.app.get("io");
        if (io) {
            const creatorId = req.user._id;
            const creator = await User.findById(creatorId).select("blockedUsers");
            const creatorBlocked = (creator?.blockedUsers || []).map((id) => (id?._id || id).toString());

            const usersWhoBlockedCreator = await User.find({
                blockedUsers: creatorId,
            }).select("_id");
            const blockedCreator = usersWhoBlockedCreator.map((u) => u._id.toString());

            const excludedSet = new Set([...creatorBlocked, ...blockedCreator]);

            // Emit to each connected user room if not excluded
            const allUsers = await User.find({ _id: { $nin: Array.from(excludedSet) } }).select("_id");
            allUsers.forEach((u) => {
                io.to(`user:${u._id.toString()}`).emit("status:new", populatedStatus);
            });
        }

        return res.status(201).json({
            success: true,
            message: "Status created successfully",
            data: populatedStatus,
        });
    } catch (error) {
        console.error("Create status error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create status",
        });
    }
};

/**
 * @desc    Get all active statuses from last 24 hours
 * @route   GET /api/status
 * @access  Private
 */
export const getStatuses = async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const currentUserId = req.user._id;

        // Find users whom current user blocked
        const currentUser = await User.findById(currentUserId).select("blockedUsers");
        const myBlockedUsers = (currentUser?.blockedUsers || []).map((id) => (id?._id || id).toString());

        // Find users who have blocked current user
        const usersWhoBlockedMe = await User.find({
            blockedUsers: currentUserId,
        }).select("_id");
        const blockedByThem = usersWhoBlockedMe.map((u) => u._id.toString());

        const excludedUserIds = Array.from(new Set([...myBlockedUsers, ...blockedByThem]));

        const statuses = await Status.find({
            createdAt: { $gte: cutoff },
            user: { $nin: excludedUserIds },
        })
            .populate("user", "name profilePicture phone isOnline")
            .populate("viewers.user", "name profilePicture phone")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: statuses,
        });
    } catch (error) {
        console.error("Get statuses error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch statuses",
        });
    }
};

/**
 * @desc    Mark a status as viewed by current user
 * @route   PUT /api/status/:id/view
 * @access  Private
 */
export const viewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const status = await Status.findById(id).populate("user", "blockedUsers");
        if (!status) {
            return res.status(404).json({
                success: false,
                message: "Status not found",
            });
        }

        const authorBlocked = status.user?.blockedUsers || [];
        if (authorBlocked.some((b) => (b?._id || b).toString() === userId.toString())) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // If user is owner, do not add as viewer
        if (status.user.toString() === userId.toString()) {
            return res.status(200).json({
                success: true,
                message: "Owner viewing own status",
            });
        }

        const alreadyViewed = status.viewers.some(
            (v) => v.user.toString() === userId.toString()
        );

        if (!alreadyViewed) {
            status.viewers.push({
                user: userId,
                viewedAt: new Date(),
            });
            await status.save();

            const io = req.app.get("io");
            if (io) {
                io.to(`user:${status.user.toString()}`).emit("status:viewed", {
                    statusId: status._id,
                    viewer: {
                        _id: req.user._id,
                        name: req.user.name,
                        profilePicture: req.user.profilePicture,
                    },
                    viewedAt: new Date(),
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Status marked as viewed",
        });
    } catch (error) {
        console.error("View status error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to mark status as viewed",
        });
    }
};

/**
 * @desc    Delete user's own status
 * @route   DELETE /api/status/:id
 * @access  Private
 */
export const deleteStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await Status.findById(id);

        if (!status) {
            return res.status(404).json({
                success: false,
                message: "Status not found",
            });
        }

        if (status.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own status",
            });
        }

        await Status.findByIdAndDelete(id);

        const io = req.app.get("io");
        if (io) {
            io.emit("status:deleted", { statusId: id });
        }

        return res.status(200).json({
            success: true,
            message: "Status deleted successfully",
        });
    } catch (error) {
        console.error("Delete status error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to delete status",
        });
    }
};
