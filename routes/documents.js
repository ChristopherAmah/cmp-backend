import express from "express";
import {
  getDocuments,
  getDocument,
  uploadDocument,
  downloadDocument,
  viewDocument,
  deleteDocument,
} from "../controllers/documentController.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import { upload } from "../config/cloudinary.js";
import multer from "multer";
import { auditLogMiddleware } from "../middleware/auditLog.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route("/")
  .get(
    getDocuments,
    auditLogMiddleware({
      action: "DOCUMENT_LIST_VIEWED",
      resourceType: "Document",
      severity: "low",
      getMetadata: (req) => ({ query: req.query }),
    })
  );

router.route("/:id")
  .get(
    getDocument,
    auditLogMiddleware({
      action: "DOCUMENT_VIEWED",
      resourceType: "Document",
      severity: "low",
    })
  )
  .delete(
    deleteDocument,
    auditLogMiddleware({
      action: "DOCUMENT_DELETED",
      resourceType: "Document",
      severity: "high",
    })
  );

router.route("/:id/download")
  .get(
    downloadDocument,
    auditLogMiddleware({
      action: "DOCUMENT_DOWNLOADED",
      resourceType: "Document",
      severity: "medium",
    })
  );

router.route("/:id/view")
  .get(
    viewDocument,
    auditLogMiddleware({
      action: "DOCUMENT_PREVIEWED",
      resourceType: "Document",
      severity: "low",
    })
  );
router.post(
  "/upload",
  authorize("admin", "super_admin"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer/Cloudinary Middleware Error:", err);
        // specific check for Multer errors
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            status: "error",
            message: `Upload error: ${err.message}`,
            code: err.code,
          });
        }
        // other errors (e.g. cloudinary)
        return res.status(500).json({
          status: "error",
          message: err.message || "File upload failed",
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
      }
      next();
    });
  },
  uploadDocument,
  auditLogMiddleware({
    action: "DOCUMENT_UPLOADED",
    resourceType: "Document",
    severity: "high",
    getResourceId: (req, res) =>
      res.locals.responseData?.data?._id ||
      req.body._id,
    getResourceName: (req, res) =>
      req.body.documentName ||
      res.locals.responseData?.data?.documentName,
    getMetadata: (req) => ({
      originalName: req.file?.originalname,
      mimeType: req.file?.mimetype,
      size: req.file?.size,
    }),
  })
);

export default router;

