import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        endpoint: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        keys: {
            p256dh: {
                type: String,
                required: true,
                trim: true,
            },
            auth: {
                type: String,
                required: true,
                trim: true,
            },
        },
        userAgent: {
            type: String,
            default: "",
        },
        deviceInfo: {
            type: String,
            default: "",
        },
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

pushSubscriptionSchema.index({ userId: 1, createdAt: -1 });

const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);

export default PushSubscription;
