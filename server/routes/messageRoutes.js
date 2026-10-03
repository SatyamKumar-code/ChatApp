import { Router } from "express";
import {
  sendMessage,
  getMessages,
  reactToMessage,
  deleteMessage,
  toggleStarMessage,
  getStarredMessages,
  forwardMessage,
} from "../controllers/messageController.js";
import protect from "../middleware/authMiddleware.js";

const router = Router();

// Send message
router.post("/", protect, sendMessage);

// Forward message to multiple conversations
router.post("/forward", protect, forwardMessage);

// Get starred messages (Must be before /:conversationId)
router.get("/starred/all", protect, getStarredMessages);

// Get messages of a conversation
router.get("/:conversationId", protect, getMessages);

// React to message
router.post("/:messageId/react", protect, reactToMessage);

// Delete message
router.post("/:messageId/delete", protect, deleteMessage);

// Toggle Star message
router.post("/:messageId/star", protect, toggleStarMessage);

export default router;
