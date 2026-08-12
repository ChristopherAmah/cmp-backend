import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getAuditLogsController,
  getRecentCriticalActionsController,
  getAuditLogStatsController,
} from "../controllers/auditLogController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get audit logs with filtering
router.get("/", getAuditLogsController);

// Get recent critical actions (for super admin notifications)
router.get("/recent-critical", getRecentCriticalActionsController);

// Get audit log statistics
router.get("/stats", getAuditLogStatsController);

export default router;
