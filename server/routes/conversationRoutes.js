import { Router } from "express";
import {
    getMyConversations,
    getOrCreateConversation,
    createGroupConversation,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    togglePinConversation,
    togglePinMessage,
    toggleGroupAdmin,
} from "../controllers/conversationController.js";
import protect from "../middleware/authMiddleware.js";

const router = Router();

// Get logged-in user's conversations (1-on-1 and Groups)
router.get("/", protect, getMyConversations);

// Get or create 1-on-1 conversation
router.post("/", protect, getOrCreateConversation);

// Create Group conversation
router.post("/group", protect, createGroupConversation);

// Update Group details
router.put("/group/:id", protect, updateGroup);

// Add members to Group
router.post("/group/:id/members", protect, addGroupMembers);

// Remove member or leave Group
router.delete("/group/:id/members/:memberId", protect, removeGroupMember);

// Promote or demote group admin
router.post("/group/:id/admins/:memberId", protect, toggleGroupAdmin);

// Pin / Unpin conversation in sidebar
router.post("/:conversationId/pin", protect, togglePinConversation);

// Pin / Unpin message inside conversation
router.post("/:conversationId/messages/:messageId/pin", protect, togglePinMessage);

export default router;