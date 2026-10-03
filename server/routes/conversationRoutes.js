import { Router } from "express";
import { getMyConversations, getOrCreateConversation } from "../controllers/conversationController.js";
import protect from "../middleware/authMiddleware.js";

const router = Router();


// Get logged-in user's conversations
router.get("/", protect, getMyConversations);


// Get or create conversation
router.post("/", protect, getOrCreateConversation);


export default router;