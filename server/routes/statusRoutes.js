import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
    createStatus,
    getStatuses,
    viewStatus,
    deleteStatus,
} from "../controllers/statusController.js";

const router = express.Router();

router.use(protect);

router.post("/", createStatus);
router.get("/", getStatuses);
router.put("/:id/view", viewStatus);
router.delete("/:id", deleteStatus);

export default router;
