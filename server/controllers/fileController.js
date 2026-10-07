import fs from "fs";
import { randomUUID } from "crypto";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Image from "../models/Image.js";
import Video from "../models/Video.js";
import Document from "../models/Document.js";
import PendingFileDelivery from "../models/PendingFileDelivery.js";
import {
  saveEncryptedFileStream,
  streamDecryptedFile,
  deleteTemporaryFile,
  calculateExpiresAt,
  temporaryFileExists,
} from "../services/fileStorageService.js";

/**
 * Sanitize filename to prevent directory traversal and illegal characters
 */
export const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== "string") return "attachment";
  // Remove directory traversal sequences
  let clean = fileName.replace(/(\.\.[\/\\]|\.\.)/g, "");
  // Replace slashes and path separators
  clean = clean.replace(/[/\\]/g, "_");
  // Replace illegal Windows & Unix filename characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"|?*]/g, "_");
  // Remove null bytes and ASCII control characters
  clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  // Strip leading dots to avoid hidden files and trim whitespace
  clean = clean.trim().replace(/^\.+/, "");
  // Remove trailing dots or spaces which cause issues in Windows filesystems
  clean = clean.replace(/[. ]+$/, "");
  if (!clean) clean = "attachment";
  // Ensure maximum length of 200 chars while preserving extension
  if (clean.length > 200) {
    const extIndex = clean.lastIndexOf(".");
    if (extIndex > -1) {
      const ext = clean.slice(extIndex);
      clean = clean.slice(0, 195 - ext.length) + ext;
    } else {
      clean = clean.slice(0, 200);
    }
  }
  return clean;
};

/**
 * Detect canonical file type (image, video, document) from MIME and extension
 */
export const detectCanonicalFileType = (mimeType = "", fileName = "", explicitType = "") => {
  if (explicitType && ["image", "video", "document"].includes(explicitType)) {
    return explicitType;
  }
  const mime = (mimeType || "").toLowerCase();
  const ext = (fileName || "").split(".").pop().toLowerCase();

  const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic", "tiff"]);
  const videoExts = new Set(["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv", "m4v", "3gp"]);

  if (mime.startsWith("image/") || imageExts.has(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || videoExts.has(ext)) {
    return "video";
  }
  return "document";
};

/**
 * Upload a file to temporary encrypted server storage
 * Creates Message, separate Model (Image/Video/Document), and PendingFileDelivery queue record
 */
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const {
      conversationId,
      receiverId: customReceiverId,
      fileType: rawFileType,
      caption = "",
      replyTo = null,
      tempId = null,
      fileId: customFileId,
      width,
      height,
      duration,
      pageCount,
      originalSenderPath,
    } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => (p?._id || p)?.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this conversation",
      });
    }

    // Determine receiver for 1-on-1 chat
    let receiverId = customReceiverId;
    if (receiverId && typeof receiverId === "object" && receiverId._id) {
      receiverId = receiverId._id.toString();
    }
    if (!receiverId && !conversation.isGroup) {
      const otherParticipant = conversation.participants.find(
        (p) => (p?._id || p)?.toString() !== req.user._id.toString()
      );
      if (otherParticipant) {
        receiverId = (otherParticipant._id || otherParticipant).toString();
      }
    }

    if (!receiverId && !conversation.isGroup) {
      return res.status(400).json({
        success: false,
        message: "Receiver could not be determined",
      });
    }

    // Determine canonical fileType & sanitize filename
    const mime = req.file.mimetype || "";
    const originalName = sanitizeFileName(req.file.originalname);
    const fileType = detectCanonicalFileType(mime, originalName, rawFileType);

    const fileId = customFileId || `file_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileSize = req.file.size;

    // Stream uploaded temporary file to encrypted disk storage
    const readStream = fs.createReadStream(req.file.path);
    const { relativeReference, iv, authTag } = await saveEncryptedFileStream(fileId, readStream);

    // Remove multer's plaintext temp file from disk
    try {
      await fs.promises.unlink(req.file.path);
    } catch {
      // ignore
    }

    // Calculate expiration date using configured retention hours (defaults to 240 hours = 10 days)
    const expiresAt = calculateExpiresAt();

    // 1. Create main Message record with common chat message fields only
    const modelRefName =
      fileType === "image"
        ? "Image"
        : fileType === "video"
        ? "Video"
        : "Document";

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      receiver: receiverId,
      text: caption ? caption.trim() : "",
      messageType: fileType,
      fileId,
      fileName: originalName,
      fileSize,
      fileTransferStatus: "pending_delivery",
      fileModelRef: modelRefName,
      replyTo: replyTo || null,
      isDelivered: false,
      isSeen: false,
    });

    // 2. Create separate Model record with file-specific metadata referencing messageId
    let fileMetadataDoc = null;
    if (fileType === "image") {
      fileMetadataDoc = await Image.create({
        messageId: message._id,
        fileId,
        fileName: originalName,
        fileSize,
        mimeType: mime,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        aspectRatio: width && height ? Number(width) / Number(height) : null,
        originalSenderPath: originalSenderPath || "",
      });
    } else if (fileType === "video") {
      fileMetadataDoc = await Video.create({
        messageId: message._id,
        fileId,
        fileName: originalName,
        fileSize,
        mimeType: mime,
        duration: duration ? Number(duration) : 0,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        originalSenderPath: originalSenderPath || "",
      });
    } else {
      const ext = originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "";
      fileMetadataDoc = await Document.create({
        messageId: message._id,
        fileId,
        fileName: originalName,
        fileSize,
        mimeType: mime,
        pageCount: pageCount ? Number(pageCount) : null,
        extension: ext,
        originalSenderPath: originalSenderPath || "",
      });
    }

    // 3. Create offline PendingFileDelivery queue item
    const pendingDelivery = await PendingFileDelivery.create({
      fileId,
      messageId: message._id,
      senderId: req.user._id,
      receiverId,
      conversationId,
      fileType,
      fileName: originalName,
      mimeType: mime,
      fileSize,
      temporaryStorageReference: relativeReference,
      encryptionIv: iv,
      encryptionTag: authTag,
      status: "pending_delivery",
      expiresAt,
    });

    // Update conversation last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate message for responses and socket broadcasts
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name phone profilePicture isOnline")
      .populate("receiver", "name phone profilePicture isOnline")
      .populate("reactions.user", "name profilePicture")
      .populate({
        path: "replyTo",
        select: "text messageType fileName fileUrl sender",
        populate: { path: "sender", select: "name" },
      });

    const msgObj = populatedMessage.toObject();
    if (fileType === "image") msgObj.imageDetails = fileMetadataDoc;
    else if (fileType === "video") msgObj.videoDetails = fileMetadataDoc;
    else if (fileType === "document") msgObj.documentDetails = fileMetadataDoc;

    msgObj.fileDelivery = {
      fileId,
      status: "pending_delivery",
      expiresAt,
      fileName: originalName,
      fileSize,
      mimeType: mime,
      fileType,
    };

    // Socket.IO broadcast
    const io = req.app.get("io");
    if (io) {
      const senderPayload = tempId ? { ...msgObj, tempId } : msgObj;

      // Send to sender
      io.to(`user:${req.user._id.toString()}`).emit("newMessage", senderPayload);

      // Send to receiver in 1-on-1 or broadcast to group participants
      if (receiverId) {
        io.to(`user:${receiverId.toString()}`).emit("newMessage", msgObj);
        io.to(`user:${receiverId.toString()}`).emit("file:available", {
          fileId,
          messageId: message._id,
          conversationId,
          sender: req.user._id,
          fileType,
          fileName: originalName,
          fileSize,
          mimeType: mime,
          status: "pending_delivery",
          expiresAt,
        });
      } else if (conversation.isGroup && Array.isArray(conversation.participants)) {
        conversation.participants.forEach((p) => {
          const pId = (p?._id || p)?.toString();
          if (pId && pId !== req.user._id.toString()) {
            io.to(`user:${pId}`).emit("newMessage", msgObj);
            io.to(`user:${pId}`).emit("file:available", {
              fileId,
              messageId: message._id,
              conversationId,
              sender: req.user._id,
              fileType,
              fileName: originalName,
              fileSize,
              mimeType: mime,
              status: "pending_delivery",
              expiresAt,
            });
          }
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: msgObj,
      fileDelivery: pendingDelivery,
    });
  } catch (error) {
    console.error("[FileUpload] Error uploading file:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload file",
      error: error.message,
    });
  }
};

/**
 * Get pending file deliveries for current user (when receiver comes online or synchronizes)
 */
export const getPendingDeliveries = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const now = new Date();

    const pendingFiles = await PendingFileDelivery.find({
      receiverId: currentUserId,
      status: {
        $in: [
          "pending_delivery",
          "receiver_online",
          "download_available",
          "available",
          "downloading",
          "waiting_for_sender",
        ],
      },
      expiresAt: { $gt: now },
    })
      .populate("senderId", "name phone profilePicture")
      .populate("messageId", "text createdAt conversation")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      pendingFiles,
    });
  } catch (error) {
    console.error("[GetPendingDeliveries] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pending file deliveries",
    });
  }
};

/**
 * Stream & download decrypted file
 * Authorized only for sender or intended receiver
 */
export const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user._id.toString();

    const delivery = await PendingFileDelivery.findOne({ fileId });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "File record not found",
      });
    }

    // Verify authorized user
    const isReceiver = delivery.receiverId.toString() === currentUserId;
    const isSender = delivery.senderId.toString() === currentUserId;

    if (!isReceiver && !isSender) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to download this file",
      });
    }

    // Check expiration
    if (new Date() > delivery.expiresAt) {
      delivery.status = "expired";
      await delivery.save();
      await deleteTemporaryFile(fileId);

      return res.status(410).json({
        success: false,
        status: "expired",
        message: "Temporary server file has expired.",
      });
    }

    // Check if file exists on disk
    if (!temporaryFileExists(fileId)) {
      return res.status(410).json({
        success: false,
        status: "expired",
        message: "Temporary file is no longer available on server.",
      });
    }

    // Mark status as downloading if it's the receiver
    if (isReceiver && delivery.status !== "completed") {
      delivery.status = "downloading";
      await delivery.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${delivery.senderId.toString()}`).emit("file:status_update", {
          fileId,
          status: "downloading",
        });
      }
    }

    // Set headers
    res.setHeader("Content-Type", delivery.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", delivery.fileSize);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(sanitizeFileName(delivery.fileName))}"`
    );

    // Stream decrypted file directly to response
    await streamDecryptedFile(fileId, delivery.encryptionIv, delivery.encryptionTag, res);
  } catch (error) {
    console.error("[DownloadFile] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to download file",
        error: error.message,
      });
    }
  }
};

/**
 * Acknowledge download completion:
 * Receiver successfully saved file locally -> Server permanently deletes temporary file!
 */
export const acknowledgeDownload = async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user._id.toString();

    const delivery = await PendingFileDelivery.findOne({ fileId });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "File record not found",
      });
    }

    // Update delivery status
    delivery.status = "completed";
    delivery.acknowledgedAt = new Date();
    delivery.downloadProgress = 100;
    await delivery.save();

    // Update Message model fileTransferStatus
    if (delivery.messageId) {
      await Message.updateOne(
        { _id: delivery.messageId },
        { fileTransferStatus: "downloaded", isDelivered: true }
      );
    }

    // Immediately delete temporary encrypted file from server disk
    await deleteTemporaryFile(fileId);

    // Notify sender and receiver via socket
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${delivery.senderId.toString()}`).emit("file:status_update", {
        fileId,
        messageId: delivery.messageId,
        status: "downloaded",
      });

      io.to(`user:${delivery.receiverId.toString()}`).emit("file:status_update", {
        fileId,
        messageId: delivery.messageId,
        status: "downloaded",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Download acknowledged. Temporary server copy deleted.",
      fileId,
      status: "downloaded",
    });
  } catch (error) {
    console.error("[AcknowledgeDownload] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to acknowledge download",
    });
  }
};

/**
 * Request redownload ("Download Again"):
 * Handles Situation A (temporary copy available) and Situation B (temporary copy expired)
 * Follows the Non-Negotiable Recovery Rule!
 */
export const requestRedownload = async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user._id.toString();

    const delivery = await PendingFileDelivery.findOne({ fileId });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "File record not found",
      });
    }

    // Situation A: Temporary server copy still exists on disk and is not expired
    const hasServerCopy = temporaryFileExists(fileId);
    const isNotExpired = new Date() < delivery.expiresAt;

    if (hasServerCopy && isNotExpired) {
      delivery.status = "available";
      await delivery.save();
      return res.status(200).json({
        success: true,
        status: "available",
        message: "Server copy available for download",
      });
    }

    // Situation B: Temporary server copy is no longer available
    // Server first checks original sender's availability to re-create the temporary copy
    const io = req.app.get("io");
    const senderIdStr = delivery.senderId.toString();

    // Check if sender is currently connected/online
    let isSenderConnected = false;
    if (io) {
      const room = io.sockets.adapter.rooms.get(`user:${senderIdStr}`);
      isSenderConnected = Boolean(room && room.size > 0);
    }

    if (isSenderConnected) {
      // Sender is online: Request automatic re-upload from sender client
      delivery.status = "waiting_for_sender";
      await delivery.save();

      io.to(`user:${senderIdStr}`).emit("file:request_reupload", {
        fileId,
        messageId: delivery.messageId,
        fileName: delivery.fileName,
        fileType: delivery.fileType,
        fileSize: delivery.fileSize,
        receiverId: currentUserId,
      });

      return res.status(200).json({
        success: true,
        status: "checking_sender",
        message: "Temporary copy unavailable. Checking sender's original file...",
      });
    } else {
      // Sender is offline: Keep request pending until sender becomes available
      delivery.status = "waiting_for_sender";
      await delivery.save();

      return res.status(200).json({
        success: true,
        status: "waiting_for_sender",
        message: "Waiting for sender to come online to re-send file...",
      });
    }
  } catch (error) {
    console.error("[RequestRedownload] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process redownload request",
    });
  }
};

/**
 * Sender client automatically re-uploads original file when requested
 */
export const reuploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided for re-upload",
      });
    }

    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: "fileId is required",
      });
    }

    const delivery = await PendingFileDelivery.findOne({ fileId });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Pending delivery record not found",
      });
    }

    // Verify current user is the sender
    if (delivery.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the original sender can re-upload this file",
      });
    }

    // Stream uploaded file to encrypted storage
    const readStream = fs.createReadStream(req.file.path);
    const { relativeReference, iv, authTag } = await saveEncryptedFileStream(fileId, readStream);

    try {
      await fs.promises.unlink(req.file.path);
    } catch {
      // ignore
    }

    // Reset retention timer
    const expiresAt = calculateExpiresAt();

    delivery.temporaryStorageReference = relativeReference;
    delivery.encryptionIv = iv;
    delivery.encryptionTag = authTag;
    delivery.status = "download_available";
    delivery.expiresAt = expiresAt;
    await delivery.save();

    // Update Message model status
    if (delivery.messageId) {
      await Message.updateOne(
        { _id: delivery.messageId },
        { fileTransferStatus: "download_available" }
      );
    }

    // Notify receiver via socket that file is ready for download
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${delivery.receiverId.toString()}`).emit("file:reupload_ready", {
        fileId,
        messageId: delivery.messageId,
        fileName: delivery.fileName,
        fileSize: delivery.fileSize,
        status: "download_available",
      });

      io.to(`user:${delivery.receiverId.toString()}`).emit("file:status_update", {
        fileId,
        status: "download_available",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Temporary server copy successfully recreated",
      fileId,
      status: "download_available",
    });
  } catch (error) {
    console.error("[ReuploadFile] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to re-upload file",
    });
  }
};

/**
 * Sender client reports that original local file was deleted / unavailable
 */
export const reportReuploadFailed = async (req, res) => {
  try {
    const { fileId } = req.body;
    const delivery = await PendingFileDelivery.findOne({ fileId });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "File record not found",
      });
    }

    delivery.status = "unavailable";
    delivery.senderAvailableForReupload = false;
    await delivery.save();

    if (delivery.messageId) {
      await Message.updateOne(
        { _id: delivery.messageId },
        { fileTransferStatus: "unavailable" }
      );
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${delivery.receiverId.toString()}`).emit("file:status_update", {
        fileId,
        status: "unavailable",
        message: "File is currently unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      status: "unavailable",
      message: "File marked as unavailable",
    });
  } catch (error) {
    console.error("[ReportReuploadFailed] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update file status",
    });
  }
};
