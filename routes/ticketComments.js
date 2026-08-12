import express from "express";
import { protect } from "../middleware/auth.js";
import { getComments, createComment } from "../controllers/ticketCommentController.js";
const router = express.Router({ mergeParams: true });
router.use(protect);
router.get("/", getComments);
router.post("/", createComment);
export default router;
