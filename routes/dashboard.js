import express from "express";
import {
  getDashboardStats,
  getRecentActivities,
} from "../controllers/dashboardController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/stats", getDashboardStats);
router.get("/recent-activities", getRecentActivities);

export default router;
