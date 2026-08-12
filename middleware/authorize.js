// Import permission utilities for enhanced authorization
import { hasMinimumRole } from '../utils/permissions.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        status: "error",
        message: "Not authorized to access this route",
      });
    }

    // Use role hierarchy check for better scalability
    if (!hasMinimumRole(userRole, roles)) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    next();
  };
};
