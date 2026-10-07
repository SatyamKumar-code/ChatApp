import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import protect from "../middleware/authMiddleware.js";
import {
    createStatus,
    getStatuses,
    viewStatus,
    deleteStatus,
} from "../controllers/statusController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const statusUploadDir = path.resolve(__dirname, "../uploads/status");

if (!fs.existsSync(statusUploadDir)) {
    fs.mkdirSync(statusUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, statusUploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || (file.mimetype.startsWith("video/") ? ".mp4" : ".jpg");
        const uniqueName = `status_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max for video or photo status
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image and video files are supported for status"), false);
        }
    },
});

const router = express.Router();

router.use(protect);

router.post("/", upload.single("media"), createStatus);
router.get("/", getStatuses);
router.put("/:id/view", viewStatus);
router.delete("/:id", deleteStatus);

export default router;
