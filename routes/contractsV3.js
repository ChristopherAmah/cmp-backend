import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { auditLogMiddleware } from "../middleware/auditLog.js";
import {
  getContracts,
  getContract,
  getContractMetrics,
  createContract,
  updateContract,
  updateContractStatus,
  deleteContract,
} from "../controllers/contractsControllerV3.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Metrics endpoint
router.get(
  "/metrics",
  requirePermission(PERMISSIONS.CONTRACTS.VIEW),
  getContractMetrics
);

// Contract routes
router
  .route("/")
  .get(
    requirePermission(PERMISSIONS.CONTRACTS.VIEW),
    getContracts,
    auditLogMiddleware({
      action: "CONTRACT_LIST_VIEWED",
      resourceType: "Contract",
      severity: "low",
      getMetadata: (req) => ({
        query: req.query,
      }),
    })
  )
  .post(
    requirePermission(PERMISSIONS.CONTRACTS.CREATE),
    createContract,
    auditLogMiddleware({
      action: "CONTRACT_CREATED",
      resourceType: "Contract",
      severity: "high",
      getResourceId: (req, res) =>
        res.locals.responseData?.data?._id || req.body._id,
      getResourceName: (req, res) =>
        req.body.title || res.locals.responseData?.data?.title,
      getMetadata: (req) => ({
        body: { ...req.body },
      }),
    })
  );

router
  .route("/:id")
  .get(
    requirePermission(PERMISSIONS.CONTRACTS.VIEW),
    getContract,
    auditLogMiddleware({
      action: "CONTRACT_VIEWED",
      resourceType: "Contract",
      severity: "low",
    })
  )
  .patch(
    requirePermission(PERMISSIONS.CONTRACTS.UPDATE),
    updateContract,
    auditLogMiddleware({
      action: "CONTRACT_UPDATED",
      resourceType: "Contract",
      severity: "medium",
      getMetadata: (req) => ({
        body: { ...req.body },
      }),
    })
  )
  .delete(
    requirePermission(PERMISSIONS.CONTRACTS.DELETE),
    deleteContract,
    auditLogMiddleware({
      action: "CONTRACT_DELETED",
      resourceType: "Contract",
      severity: "high",
    })
  );

// Status update endpoint
router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.CONTRACTS.UPDATE),
  updateContractStatus,
  auditLogMiddleware({
    action: "CONTRACT_STATUS_UPDATED",
    resourceType: "Contract",
    severity: "medium",
    getMetadata: (req) => ({
      newStatus: req.body.status,
    }),
  })
);

export default router;