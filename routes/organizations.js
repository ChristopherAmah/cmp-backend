import express from 'express';
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/organizationController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { requirePermission } from '../middleware/permissions.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { auditLogMiddleware } from '../middleware/auditLog.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(
    requirePermission(PERMISSIONS.ORGANIZATIONS.VIEW),
    getOrganizations,
    auditLogMiddleware({
      action: 'ORGANIZATION_LIST_VIEWED',
      resourceType: 'Organization',
      severity: 'low',
      getMetadata: (req) => ({ query: req.query }),
    })
  )
  .post(
    requirePermission(PERMISSIONS.ORGANIZATIONS.CREATE),
    createOrganization,
    auditLogMiddleware({
      action: 'ORGANIZATION_CREATED',
      resourceType: 'Organization',
      severity: 'high',
      getResourceId: (req, res) =>
        res.locals.responseData?.data?._id || req.body._id,
      getResourceName: (req, res) =>
        req.body.name || res.locals.responseData?.data?.name,
      getMetadata: (req) => ({ body: { ...req.body } }),
    })
  );
router.route('/:id')
  .get(
    requirePermission(PERMISSIONS.ORGANIZATIONS.VIEW),
    getOrganization,
    auditLogMiddleware({
      action: 'ORGANIZATION_VIEWED',
      resourceType: 'Organization',
      severity: 'low',
    })
  )
  .patch(
    requirePermission(PERMISSIONS.ORGANIZATIONS.UPDATE),
    updateOrganization,
    auditLogMiddleware({
      action: 'ORGANIZATION_UPDATED',
      resourceType: 'Organization',
      severity: 'medium',
      getMetadata: (req) => ({ body: { ...req.body } }),
    })
  );
router.delete(
  '/:id',
  authorize('super_admin'),
  deleteOrganization,
  auditLogMiddleware({
    action: 'ORGANIZATION_DELETED',
    resourceType: 'Organization',
    severity: 'high',
  })
);

export default router;




