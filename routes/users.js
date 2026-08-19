import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import {
  getAllUsers,
  getDevelopers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  uploadProfilePicture as uploadProfilePictureHandler,
} from '../controllers/userController.js';
import { uploadProfilePicture as uploadMiddleware } from '../config/cloudinary.js';
import { auditLogMiddleware } from '../middleware/auditLog.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all users (admin+)
router.get(
  '/',
  authorize('admin', 'super_admin'),
  getAllUsers,
  auditLogMiddleware({
    action: 'USER_LIST_VIEWED',
    resourceType: 'User',
    severity: 'low',
    getMetadata: (req) => ({ query: req.query }),
  })
);

// Get developer roster for ticket assignment
router.get(
  '/developers',
  authorize('admin', 'super_admin', 'support_lead'),
  getDevelopers
);

// Get user by ID
router.get(
  '/:id',
  getUserById,
  auditLogMiddleware({
    action: 'USER_VIEWED',
    resourceType: 'User',
    severity: 'low',
  })
);

// Create user (super_admin only)
router.post(
  '/',
  authorize('super_admin'),
  createUser,
  auditLogMiddleware({
    action: 'USER_CREATED',
    resourceType: 'User',
    severity: 'high',
    getResourceId: (req, res) =>
      res.locals.responseData?.data?._id || req.body._id,
    getResourceName: (req, res) =>
      req.body.name || res.locals.responseData?.data?.name,
    getMetadata: (req) => ({ body: { ...req.body } }),
  })
);

// Update user
router.patch(
  '/:id',
  updateUser,
  auditLogMiddleware({
    action: 'USER_UPDATED',
    resourceType: 'User',
    severity: 'medium',
    getMetadata: (req) => ({ body: { ...req.body } }),
  })
);

// Upload profile picture
router.post(
  '/:id/profile-picture',
  uploadMiddleware.single('picture'),
  uploadProfilePictureHandler,
  auditLogMiddleware({
    action: 'USER_PROFILE_PICTURE_UPDATED',
    resourceType: 'User',
    severity: 'medium',
  })
);

// Toggle user status (admin+)
router.patch(
  '/:id/toggle-status',
  authorize('admin', 'super_admin'),
  toggleUserStatus,
  auditLogMiddleware({
    action: 'USER_STATUS_TOGGLED',
    resourceType: 'User',
    severity: 'medium',
  })
);

// Delete user (super_admin only)
router.delete(
  '/:id',
  authorize('super_admin'),
  deleteUser,
  auditLogMiddleware({
    action: 'USER_DELETED',
    resourceType: 'User',
    severity: 'high',
  })
);

export default router;

