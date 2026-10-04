import Call from "../models/Call.js";

/**
 * @desc    Get call history for current logged-in user
 * @route   GET /api/calls
 * @access  Private
 */
export const getMyCalls = async (req, res) => {
    try {
        const userId = req.user._id;

        const calls = await Call.find({
            $or: [
                { caller: userId },
                { receiver: userId },
                { groupParticipants: userId },
            ],
            deletedFor: { $ne: userId },
        })
            .populate("caller", "name phone profilePicture isOnline")
            .populate("receiver", "name phone profilePicture isOnline")
            .populate("groupParticipants", "name phone profilePicture isOnline")
            .populate("conversation", "groupName groupAvatar isGroup")
            .sort({ createdAt: -1 })
            .limit(100);

        // Format calls for client presentation
        const formattedCalls = calls.map((call) => {
            const isCaller = call.caller?._id?.toString() === userId.toString();
            let contactUser;

            if (call.isGroupCall) {
                contactUser = {
                    _id: call.conversation?._id || call._id,
                    name: call.conversation?.groupName || "Group Call",
                    profilePicture: call.conversation?.groupAvatar || "",
                    phone: "",
                    isGroup: true,
                };
            } else {
                contactUser = isCaller ? call.receiver : call.caller;
            }

            let directionStatus = call.status;
            if (call.status === "completed" || call.status === "rejected") {
                directionStatus = isCaller ? "outgoing" : "incoming";
            } else if (call.status === "missed") {
                directionStatus = isCaller ? "outgoing" : "missed";
            }

            return {
                id: call._id.toString(),
                _id: call._id.toString(),
                user: contactUser || { name: "Unknown", phone: "", profilePicture: "" },
                isCaller,
                isGroupCall: Boolean(call.isGroupCall),
                callType: call.callType || "video",
                status: directionStatus,
                originalStatus: call.status,
                duration: call.duration || 0,
                timestamp: call.createdAt,
                createdAt: call.createdAt,
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedCalls,
        });
    } catch (error) {
        console.error("Get calls error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch call history",
        });
    }
};

/**
 * @desc    Log a new call record
 * @route   POST /api/calls
 * @access  Private
 */
export const logCall = async (req, res) => {
    try {
        const {
            receiverId,
            callType = "video",
            status = "completed",
            duration = 0,
            conversationId = null,
        } = req.body;

        if (!receiverId) {
            return res.status(400).json({
                success: false,
                message: "Receiver ID is required",
            });
        }

        const callRecord = await Call.create({
            caller: req.user._id,
            receiver: receiverId,
            callType,
            status,
            duration,
            conversation: conversationId || null,
        });

        const populated = await Call.findById(callRecord._id)
            .populate("caller", "name phone profilePicture isOnline")
            .populate("receiver", "name phone profilePicture isOnline");

        // Broadcast to caller and receiver rooms
        const io = req.app.get("io");
        if (io) {
            io.to(`user:${req.user._id.toString()}`).emit("call:newRecord", populated);
            io.to(`user:${receiverId.toString()}`).emit("call:newRecord", populated);
        }

        return res.status(201).json({
            success: true,
            data: populated,
        });
    } catch (error) {
        console.error("Log call error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to log call",
        });
    }
};

/**
 * @desc    Clear call history for logged-in user
 * @route   DELETE /api/calls/clear
 * @access  Private
 */
export const clearMyCalls = async (req, res) => {
    try {
        const userId = req.user._id;

        await Call.updateMany(
            {
                $or: [{ caller: userId }, { receiver: userId }],
            },
            {
                $addToSet: { deletedFor: userId },
            }
        );

        return res.status(200).json({
            success: true,
            message: "Call history cleared successfully",
        });
    } catch (error) {
        console.error("Clear calls error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to clear call history",
        });
    }
};
