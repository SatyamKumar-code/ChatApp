import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import PendingFileDelivery from "../models/PendingFileDelivery.js";
import Message from "../models/Message.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.resolve(__dirname, "../temp_transfers");

// Ensure temp_transfers directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Derive a consistent 32-byte key for temporary server storage encryption
const getEncryptionKey = () => {
  const secret =
    process.env.FILE_ENCRYPTION_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    "chatapp_default_temporary_file_storage_secret_key_32";
  return crypto.createHash("sha256").update(secret).digest();
};

/**
 * Get configured retention hours from environment variable (default: 240 hours / 10 days)
 */
export const getRetentionHours = () => {
  const hours = parseInt(process.env.FILE_RETENTION_HOURS, 10);
  return !isNaN(hours) && hours > 0 ? hours : 240;
};

/**
 * Calculate expiresAt Date based on configured retention period
 */
export const calculateExpiresAt = (fromDate = new Date()) => {
  const hours = getRetentionHours();
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
};

/**
 * Encrypt and stream an incoming file stream directly to disk in temp_transfers
 * Uses AES-256-GCM for authenticated encryption
 * Avoids loading full file into Node.js RAM
 */
export const saveEncryptedFileStream = (fileId, readableStream) => {
  return new Promise((resolve, reject) => {
    try {
      const key = getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      const targetPath = path.join(TEMP_DIR, `${fileId}.enc`);
      const writeStream = fs.createWriteStream(targetPath);

      readableStream
        .pipe(cipher)
        .pipe(writeStream);

      writeStream.on("finish", () => {
        const authTag = cipher.getAuthTag();
        resolve({
          filePath: targetPath,
          relativeReference: `temp_transfers/${fileId}.enc`,
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
        });
      });

      writeStream.on("error", (err) => {
        reject(err);
      });

      readableStream.on("error", (err) => {
        reject(err);
      });

      cipher.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Check if the temporary file exists on disk
 */
export const temporaryFileExists = (fileId) => {
  const filePath = path.join(TEMP_DIR, `${fileId}.enc`);
  return fs.existsSync(filePath);
};

/**
 * Stream and decrypt a file directly to the HTTP response stream
 */
export const streamDecryptedFile = (fileId, ivHex, authTagHex, outputResponse) => {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(TEMP_DIR, `${fileId}.enc`);

      if (!fs.existsSync(filePath)) {
        return reject(new Error("Temporary file not found on disk"));
      }

      const key = getEncryptionKey();
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      const readStream = fs.createReadStream(filePath);

      readStream
        .pipe(decipher)
        .pipe(outputResponse);

      outputResponse.on("finish", () => {
        resolve();
      });

      readStream.on("error", (err) => {
        reject(err);
      });

      decipher.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Safely delete temporary file from server disk
 */
export const deleteTemporaryFile = async (fileId) => {
  try {
    const filePath = path.join(TEMP_DIR, `${fileId}.enc`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`[FileStorage] Deleted temporary file: ${fileId}.enc`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[FileStorage] Error deleting temporary file ${fileId}:`, err.message);
    return false;
  }
};

/**
 * Cleanup expired files from disk and update status in database
 * Runs periodically and on server boot
 */
export const cleanupExpiredFiles = async (io = null) => {
  try {
    const now = new Date();
    const expiredDeliveries = await PendingFileDelivery.find({
      expiresAt: { $lte: now },
      status: { $nin: ["expired", "downloaded", "completed"] },
    });

    if (expiredDeliveries.length > 0) {
      console.log(`[FileRetention] Found ${expiredDeliveries.length} expired file deliveries to clean up.`);

      for (const item of expiredDeliveries) {
        // Delete temporary file from disk
        await deleteTemporaryFile(item.fileId);

        // Update queue status
        item.status = "expired";
        item.deletedAt = now;
        await item.save();

        // Update Message model status
        if (item.messageId) {
          await Message.updateOne(
            { _id: item.messageId },
            { fileTransferStatus: "expired" }
          );
        }

        // Notify online clients via socket
        if (io) {
          io.to(`user:${item.receiverId.toString()}`).emit("file:status_update", {
            fileId: item.fileId,
            messageId: item.messageId,
            status: "expired",
            message: "File is no longer available",
          });
          io.to(`user:${item.senderId.toString()}`).emit("file:status_update", {
            fileId: item.fileId,
            messageId: item.messageId,
            status: "expired",
          });
        }
      }
    }

    // Also scan temp directory for any orphan .enc files older than retention hours
    const maxAgeMs = getRetentionHours() * 60 * 60 * 1000;
    const files = await fs.promises.readdir(TEMP_DIR);
    for (const f of files) {
      if (f.endsWith(".enc")) {
        const fullPath = path.join(TEMP_DIR, f);
        try {
          const stats = await fs.promises.stat(fullPath);
          if (now.getTime() - stats.mtime.getTime() > maxAgeMs) {
            await fs.promises.unlink(fullPath);
            console.log(`[FileRetention] Cleaned up orphan file: ${f}`);
          }
        } catch {
          // ignore stat errors
        }
      }
    }
  } catch (error) {
    console.error("[FileRetention] Error running expired file cleanup:", error);
  }
};
