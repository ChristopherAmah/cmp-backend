import { hasPermission, hasMinimumRole } from '../utils/permissions.js';

/**
 * Middleware to check if user has specific permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        status: "error",
        message: "Not authorized to access this route",
      });
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        status: "error",
        message: `Permission '${permission}' required`,
      });
    }

    next();
  };
};

/**
 * Enhanced authorize middleware with permission support
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        status: "error",
        message: "Not authorized to access this route",
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

/**
 * Check resource-level permissions (e.g., user can only access their org's contracts)
 */
export const checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    const user = req.user;
    const resourceId = req.params.id;

    try {
      // Super admin can access all resources
      if (user.role === 'super_admin') {
        return next();
      }

      // Admin can access all resources
      if (user.role === 'admin') {
        return next();
      }

      // For users, check organization membership
      if (user.role === 'user' && resourceType === 'contract') {
        const Contract = (await import('../models/Contract.js')).default;
        const Organization = (await import('../models/Organization.js')).default;
        
        const contract = await Contract.findById(resourceId);
        if (!contract) {
          return res.status(404).json({
            status: "error",
            message: "Resource not found",
          });
        }

        // Check if user's organization matches contract's organization
        const userOrg = await Organization.findOne({ 
          members: user._id 
        });
        
        if (userOrg && contract.organization.toString() === userOrg._id.toString()) {
          return next();
        }

        return res.status(403).json({
          status: "error",
          message: "Access denied to this resource",
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  };
};

