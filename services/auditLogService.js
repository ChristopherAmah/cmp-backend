import AuditLog from "../models/AuditLog.js";

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {Object} params.user - User object (must have _id, email, name, role)
 * @param {String} params.action - Action performed (e.g., "CONTRACT_CREATED")
 * @param {String} params.resourceType - Type of resource (e.g., "Contract", "Invoice")
 * @param {String} params.resourceId - ID of the resource (optional)
 * @param {String} params.resourceName - Human-readable name of resource (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @param {String} params.status - Status of action: "success", "failure", "pending" (default: "success")
 * @param {String} params.errorMessage - Error message if action failed (optional)
 * @param {String} params.severity - Severity level: "low", "medium", "high", "critical" (default: "medium")
 * @param {Object} params.request - Express request object (for IP and user agent)
 */
export async function createAuditLog({
  user,
  action,
  resourceType,
  resourceId = null,
  resourceName = null,
  metadata = {},
  status = "success",
  errorMessage = null,
  severity = "medium",
  request = null,
}) {
  try {
    // Extract IP address and user agent from request
    const ipAddress = request
      ? request.ip ||
        request.headers["x-forwarded-for"]?.split(",")[0] ||
        request.connection?.remoteAddress ||
        "unknown"
      : null;

    const userAgent = request ? request.headers["user-agent"] || null : null;

    const auditLog = await AuditLog.create({
      userId: user._id || user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action,
      resourceType,
      resourceId,
      resourceName,
      ipAddress,
      userAgent,
      metadata,
      status,
      errorMessage,
      severity,
    });

    return auditLog;
  } catch (error) {
    // Don't throw errors from audit logging - log to console instead
    console.error("Failed to create audit log:", error);
    return null;
  }
}

/**
 * Get audit logs with filtering, pagination, and sorting
 */
export async function getAuditLogs({
  page = 1,
  limit = 50,
  userId = null,
  userRole = null,
  action = null,
  resourceType = null,
  resourceId = null,
  severity = null,
  status = null,
  startDate = null,
  endDate = null,
  search = null,
  sortBy = "createdAt",
  sortOrder = "desc",
  ipAddress = null,
}) {
  const query = {};

  if (userId) query.userId = userId;
  if (userRole) query.userRole = userRole;
  if (action) query.action = action;
  if (resourceType) query.resourceType = resourceType;
  if (resourceId) query.resourceId = resourceId;
  if (severity) query.severity = severity;
  if (status) query.status = status;
  if (ipAddress) query.ipAddress = { $regex: ipAddress, $options: "i" };

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      // Include the entire end date (set to end of day)
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDateObj;
    }
  }

  // Enhanced search filter (searches in multiple fields including metadata)
  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    query.$or = [
      { action: searchRegex },
      { resourceType: searchRegex },
      { userName: searchRegex },
      { userEmail: searchRegex },
      { resourceName: searchRegex },
      { ipAddress: searchRegex },
      { errorMessage: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  // Build sort object
  const sortObj = {};
  const validSortFields = {
    createdAt: "createdAt",
    userName: "userName",
    userEmail: "userEmail",
    action: "action",
    severity: "severity",
    status: "status",
    resourceType: "resourceType",
  };
  
  const sortField = validSortFields[sortBy] || "createdAt";
  sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("userId", "name email role")
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get recent critical/high severity actions for super admin notifications
 */
export async function getRecentCriticalActions(since = null) {
  const query = {
    severity: { $in: ["high", "critical"] },
  };

  if (since) {
    query.createdAt = { $gte: new Date(since) };
  }

  const logs = await AuditLog.find(query)
    .populate("userId", "name email role")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return logs;
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats({
  startDate = null,
  endDate = null,
  userRole = null,
}) {
  const matchQuery = {};

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  if (userRole) {
    matchQuery.userRole = userRole;
  }

  const stats = await AuditLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        byAction: {
          $push: "$action",
        },
        bySeverity: {
          $push: "$severity",
        },
        byStatus: {
          $push: "$status",
        },
        byResourceType: {
          $push: "$resourceType",
        },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalActions: 0,
      byAction: {},
      bySeverity: {},
      byStatus: {},
      byResourceType: {},
    };
  }

  const result = stats[0];

  // Count occurrences
  const countOccurrences = (arr) => {
    return arr.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  };

  return {
    totalActions: result.totalActions,
    byAction: countOccurrences(result.byAction),
    bySeverity: countOccurrences(result.bySeverity),
    byStatus: countOccurrences(result.byStatus),
    byResourceType: countOccurrences(result.byResourceType),
  };
}

/**
 * Delete old audit logs (for data retention policies)
 */
export async function deleteOldAuditLogs(olderThanDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await AuditLog.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  return result.deletedCount;
}
