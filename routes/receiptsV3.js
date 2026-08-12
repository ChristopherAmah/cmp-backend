import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  createReceiptController,
  createReceiptWithProofController,
  getReceiptsForInvoiceController,
  getReceiptController,
  reverseReceiptController,
} from "../controllers/receiptsControllerV3.js";

// Configure Cloudinary storage for receipt proofs
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "receipt-proofs",
    resource_type: "raw",
    allowed_formats: ["pdf"],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

const router = express.Router();

// All routes require authentication
router.use(protect);

// Receipt routes
router
  .route("/")
  .post(requirePermission(PERMISSIONS.PAYMENTS.CREATE), createReceiptController);

router.get(
  "/invoice/:invoiceId",
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getReceiptsForInvoiceController
);

// Create receipt with proof upload
router.post(
  "/invoice/:invoiceId/with-proof",
  requirePermission(PERMISSIONS.PAYMENTS.CREATE),
  upload.single("proofFile"),
  createReceiptWithProofController
);

router
  .route("/:id")
  .get(requirePermission(PERMISSIONS.PAYMENTS.VIEW), getReceiptController);

router.post(
  "/:id/reverse",
  requirePermission(PERMISSIONS.PAYMENTS.UPDATE),
  reverseReceiptController
);

export default router;
