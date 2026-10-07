import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import protect from "../middleware/authMiddleware.js";
import {
  uploadFile,
  getPendingDeliveries,
  downloadFile,
  acknowledgeDownload,
  requestRedownload,
  reuploadFile,
  reportReuploadFailed,
} from "../controllers/fileController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_TMP_DIR = path.resolve(__dirname, "../temp_transfers/tmp");

if (!fs.existsSync(UPLOAD_TMP_DIR)) {
  fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
}

// Multer disk storage - streams chunks to disk instead of filling Node.js RAM
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_TMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "chunk-" + uniqueSuffix + path.extname(file.originalname || ""));
  },
});

// Dangerous executable extensions blacklist for security
const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".vbs", ".msi", ".scr", ".com",
  ".pif", ".application", ".gadget", ".hta", ".cpl", ".msc", ".jar", ".ps1"
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error("Executable and script files are not allowed for security reasons"), false);
    }
    cb(null, true);
  },
});

const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("[Multer Upload Error]:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed",
      });
    }
    next();
  });
};

const router = Router();

// Upload file for delivery (creates temporary encrypted storage + models)
router.post("/upload", protect, uploadSingle, uploadFile);

// Get pending file deliveries for current user
router.get("/pending", protect, getPendingDeliveries);

// Download file stream (authenticated and authorized)
router.get("/download/:fileId", protect, downloadFile);

// Acknowledge file download completion (triggers temporary file deletion)
router.post("/acknowledge/:fileId", protect, acknowledgeDownload);

// Request redownload ("Download Again") with automated fallback checks
router.post("/redownload-request/:fileId", protect, requestRedownload);

// Sender re-uploading original file on recovery request
router.post("/reupload", protect, uploadSingle, reuploadFile);

// Sender reporting original file missing
router.post("/reupload-failed", protect, reportReuploadFailed);

export default router;
