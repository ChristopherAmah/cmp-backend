import { createAuditLog } from "../services/auditLogService.js";

/**
 * Middleware to automatically log actions
 * Usage: Add this middleware after the action handler
 * 
 * Example:
 * router.post('/contracts', protect, createContract, auditLogMiddleware({
 *   action: 'CONTRACT_CREATED',
 *   resourceType: 'Contract',
 *   getResourceId: (req, res) => res.locals.contractId || req.body._id,
 *   getResourceName: (req, res) => req.body.title || req.body.name,
 *   getMetadata: (req, res) => ({ ...req.body }),
 *   severity: 'medium',
 * }))
 */
export function auditLogMiddleware(options) {
  return async (req, res, next) => {
    // Store original json and send functions
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override res.json to capture response
    res.json = function (data) {
      res.locals.responseData = data;
      return originalJson(data);
    };

    res.send = function (data) {
      res.locals.responseData = data;
      return originalSend(data);
    };

    // After response is sent, log the action
    res.on("finish", async () => {
      try {
        // Only log if user is authenticated
        if (!req.user) return;

        const status =
          res.statusCode >= 200 && res.statusCode < 300
            ? "success"
            : res.statusCode >= 400
            ? "failure"
            : "pending";

        const errorMessage =
          status === "failure" && res.locals.responseData?.message
            ? res.locals.responseData.message
            : null;

        // Get resource ID and name
        const resourceId =
          typeof options.getResourceId === "function"
            ? options.getResourceId(req, res)
            : options.resourceId || req.params.id || res.locals.responseData?.data?._id;

        const resourceName =
          typeof options.getResourceName === "function"
            ? options.getResourceName(req, res)
            : options.resourceName ||
              req.body?.title ||
              req.body?.name ||
              res.locals.responseData?.data?.title ||
              res.locals.responseData?.data?.name;

        // Get metadata
        const metadata =
          typeof options.getMetadata === "function"
            ? options.getMetadata(req, res)
            : options.metadata || {};

        await createAuditLog({
          user: req.user,
          action: options.action,
          resourceType: options.resourceType,
          resourceId,
          resourceName,
          metadata: {
            ...metadata,
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
          },
          status,
          errorMessage,
          severity: options.severity || "medium",
          request: req,
        });
      } catch (error) {
        // Don't let audit logging errors break the request
        console.error("Audit logging error:", error);
      }
    });

    next();
  };
}

/**
 * Helper function to manually create audit logs in controllers
 * Use this when you need more control over what gets logged
 */
export async function logAction({
  req,
  action,
  resourceType,
  resourceId = null,
  resourceName = null,
  metadata = {},
  status = "success",
  errorMessage = null,
  severity = "medium",
}) {
  if (!req.user) return null;

  return await createAuditLog({
    user: req.user,
    action,
    resourceType,
    resourceId,
    resourceName,
    metadata,
    status,
    errorMessage,
    severity,
    request: req,
  });
}
