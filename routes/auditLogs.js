import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  getAuditLogsController,
  getRecentCriticalActionsController,
  getAuditLogStatsController,
} from "../controllers/auditLogController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get audit logs with filtering
router.get("/", requirePermission(PERMISSIONS.SYSTEM.VIEW_LOGS), getAuditLogsController);

// Get recent critical actions (for super admin notifications)
router.get("/recent-critical", requirePermission(PERMISSIONS.SYSTEM.VIEW_LOGS), getRecentCriticalActionsController);

// Get audit log statistics
router.get("/stats", requirePermission(PERMISSIONS.SYSTEM.VIEW_LOGS), getAuditLogStatsController);

export default router;
