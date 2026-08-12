import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { auditLogMiddleware } from "../middleware/auditLog.js";
import {
  getInvoices,
  getInvoice,
  createInvoiceController,
  updateInvoiceController,
  issueInvoiceController,
  voidInvoiceController,
  recordPaymentController,
} from "../controllers/invoicesControllerV3.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Invoice routes
router
  .route("/")
  .get(
    requirePermission(PERMISSIONS.PAYMENTS.VIEW),
    getInvoices,
    auditLogMiddleware({
      action: "INVOICE_LIST_VIEWED",
      resourceType: "Invoice",
      severity: "low",
      getMetadata: (req) => ({ query: req.query }),
    })
  )
  .post(
    requirePermission(PERMISSIONS.PAYMENTS.CREATE),
    createInvoiceController,
    auditLogMiddleware({
      action: "INVOICE_CREATED",
      resourceType: "Invoice",
      severity: "high",
      getResourceId: (req, res) =>
        res.locals.responseData?.data?._id || req.body._id,
      getResourceName: (req, res) =>
        req.body.invoiceNumber ||
        res.locals.responseData?.data?.invoiceNumber,
      getMetadata: (req) => ({
        body: { ...req.body },
      }),
    })
  );

router
  .route("/:id")
  .get(
    requirePermission(PERMISSIONS.PAYMENTS.VIEW),
    getInvoice,
    auditLogMiddleware({
      action: "INVOICE_VIEWED",
      resourceType: "Invoice",
      severity: "low",
    })
  )
  .put(
    requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
    updateInvoiceController,
    auditLogMiddleware({
      action: "INVOICE_UPDATED",
      resourceType: "Invoice",
      severity: "medium",
      getMetadata: (req) => ({
        body: { ...req.body },
      }),
    })
  );

router.post(
  "/:id/issue",
  requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
  issueInvoiceController,
  auditLogMiddleware({
    action: "INVOICE_ISSUED",
    resourceType: "Invoice",
    severity: "high",
  })
);

router.post(
  "/:id/void",
  requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
  voidInvoiceController,
  auditLogMiddleware({
    action: "INVOICE_VOIDED",
    resourceType: "Invoice",
    severity: "high",
  })
);

router.post(
  "/:id/pay",
  requirePermission(PERMISSIONS.PAYMENTS.CREATE),
  recordPaymentController,
  auditLogMiddleware({
    action: "INVOICE_PAYMENT_RECORDED",
    resourceType: "Invoice",
    severity: "high",
    getMetadata: (req) => ({
      body: { ...req.body },
    }),
  })
);

export default router;
