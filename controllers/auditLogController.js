import {
  getAuditLogs,
  getRecentCriticalActions,
  getAuditLogStats,
} from "../services/auditLogService.js";
import { hasPermission } from "../utils/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";

// GET /api/audit-logs (super_admin and admin only)
export const getAuditLogsController = async (req, res) => {
  try {
    if (
      !hasPermission(req.user.role, PERMISSIONS.SYSTEM.VIEW_LOGS) &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view audit logs",
      });
    }

    const {
      page = 1,
      limit = 50,
      userId,
      userRole,
      action,
      resourceType,
      resourceId,
      severity,
      status,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      ipAddress,
    } = req.query;

    const result = await getAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      userId,
      userRole,
      action,
      resourceType,
      resourceId,
      severity,
      status,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
      ipAddress,
    });

    res.status(200).json({
      status: "success",
      data: result.logs,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch audit logs",
    });
  }
};

// GET /api/audit-logs/recent-critical (super_admin only)
export const getRecentCriticalActionsController = async (req, res) => {
  try {
    // Only super_admin can view critical actions
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        status: "error",
        message: "Only super admins can view critical actions",
      });
    }

    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours by default

    const logs = await getRecentCriticalActions(since);

    res.status(200).json({
      status: "success",
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error("Error fetching recent critical actions:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch recent critical actions",
    });
  }
};

// GET /api/audit-logs/stats (super_admin and admin only)
export const getAuditLogStatsController = async (req, res) => {
  try {
    // Check permission
    if (
      !hasPermission(req.user.role, PERMISSIONS.SYSTEM.VIEW_LOGS) &&
      req.user.role !== "super_admin"
    ) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view audit log statistics",
      });
    }

    const { startDate, endDate, userRole } = req.query;

    const stats = await getAuditLogStats({
      startDate,
      endDate,
      userRole,
    });

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching audit log stats:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch audit log statistics",
    });
  }
};
