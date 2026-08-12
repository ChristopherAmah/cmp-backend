import express from "express";
import { protect } from "../middleware/auth.js";
import {
  deleteNotification,
  getNotifications,
  markNotificationRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect);
router.get("/", getNotifications);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

export default router;
