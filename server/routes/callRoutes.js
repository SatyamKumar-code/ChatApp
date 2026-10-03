import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
    getMyCalls,
    logCall,
    clearMyCalls,
} from "../controllers/callController.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyCalls);
router.post("/", logCall);
router.delete("/clear", clearMyCalls);

export default router;
