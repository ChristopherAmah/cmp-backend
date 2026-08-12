import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  generateInvoiceDocument,
  getInvoiceHtml,
  getInvoiceDocumentVersions,
  getLatestInvoiceDocument,
  generateReceiptDocument,
  getReceiptHtml,
  getReceiptDocumentVersions,
  getLatestReceiptDocument,
  getGeneratedDocument,
} from "../controllers/documentGenerationController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============================================================================
// INVOICE DOCUMENTS
// ============================================================================

// Generate invoice PDF
router.post(
  "/invoices/:id/generate",
  requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
  generateInvoiceDocument
);

// Get invoice as HTML (preview)
router.get(
  "/invoices/:id/html",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getInvoiceHtml
);

// Get all versions of invoice documents
router.get(
  "/invoices/:id/versions",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getInvoiceDocumentVersions
);

// Get latest invoice document
router.get(
  "/invoices/:id/latest",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getLatestInvoiceDocument
);

// ============================================================================
// RECEIPT DOCUMENTS
// ============================================================================

// Generate receipt PDF
router.post(
  "/receipts/:id/generate",
  requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
  generateReceiptDocument
);

// Get receipt as HTML (preview)
router.get(
  "/receipts/:id/html",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getReceiptHtml
);

// Get all versions of receipt documents
router.get(
  "/receipts/:id/versions",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getReceiptDocumentVersions
);

// Get latest receipt document
router.get(
  "/receipts/:id/latest",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getLatestReceiptDocument
);

// ============================================================================
// GENERAL
// ============================================================================

// Get a specific generated document
router.get(
  "/:id",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getGeneratedDocument
);

export default router;
