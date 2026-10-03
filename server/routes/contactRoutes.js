import { Router } from "express";
import protect from "../middleware/authMiddleware.js";

import { getContacts, addContact } from "../controllers/contactController.js";

const contactRouter = Router();

contactRouter.get("/", protect, getContacts);
contactRouter.post("/", protect, addContact);

export default contactRouter;