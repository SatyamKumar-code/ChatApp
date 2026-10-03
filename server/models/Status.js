import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["text", "photo"],
            default: "text",
        },
        text: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },
        photoUrl: {
            type: String,
            default: "",
        },
        gradient: {
            type: String,
            default: "from-purple-600 to-indigo-700",
        },
        viewers: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                viewedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 86400, // MongoDB TTL index: automatically deletes document after 24 hours (86400 seconds)
        },
    },
    {
        timestamps: true,
    }
);

statusSchema.index({ createdAt: -1 });

const Status = mongoose.model("Status", statusSchema);

export default Status;
