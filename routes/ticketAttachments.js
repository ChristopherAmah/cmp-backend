import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { uploadTicketAttachment } from "../config/cloudinary.js";
import {
  getTicketAttachments,
  uploadTicketAttachmentFile,
  downloadTicketAttachment,
} from "../controllers/ticketAttachmentController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);
router.get("/", getTicketAttachments);
router.get("/:attachmentId/download", downloadTicketAttachment);
router.post("/upload", (req, res, next) => {
  uploadTicketAttachment.single("file")(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError ? 400 : 422;
    return res.status(status).json({ status: "error", message: error.message || "Attachment upload failed" });
  });
}, uploadTicketAttachmentFile);

export default router;
