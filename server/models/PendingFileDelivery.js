import mongoose from "mongoose";

const pendingFileDeliverySchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    fileType: {
      type: String,
      enum: ["image", "video", "document"],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    temporaryStorageReference: {
      type: String,
      required: true,
    },
    encryptionIv: {
      type: String,
      default: "",
    },
    encryptionTag: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "uploading",
        "uploaded",
        "pending_delivery",
        "receiver_online",
        "download_available",
        "available",
        "downloading",
        "completed",
        "downloaded",
        "failed",
        "expired",
        "cancelled",
        "unavailable",
        "waiting_for_sender",
      ],
      default: "pending_delivery",
      index: true,
    },
    downloadProgress: {
      type: Number,
      default: 0,
    },
    senderAvailableForReupload: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const PendingFileDelivery = mongoose.model(
  "PendingFileDelivery",
  pendingFileDeliverySchema
);

export default PendingFileDelivery;
