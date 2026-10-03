import { Router } from "express";
import { sendMessage, getMessages } from "../controllers/messageController.js";
import protect from "../middleware/authMiddleware.js";

const router = Router();


// Send message
router.post("/", protect, sendMessage);


// Get messages of a conversation
router.get("/:conversationId", protect, getMessages);


export default router;
