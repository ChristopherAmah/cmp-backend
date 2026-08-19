import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // PRD Compliance: Save to organization-specific folder
    // Note: req.body must be populated. Multer processes fields in order.
    // Frontend MUST send organizationId before the file.
    const orgId = req.body.organizationId || "uncategorized";
    return {
      folder: `cmp-documents/${orgId}`,
      allowed_formats: ["pdf"],
      resource_type: "raw",
    };
  },
});

const contractStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const contractId = req.body.contractId || req.params.id || "uncategorized";
    return {
      folder: `cmp-contracts/${contractId}`,
      allowed_formats: ["pdf", "docx"],
      resource_type: "raw",
    };
  },
});

const paymentFilesStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const paymentId =
      req.body.paymentId || req.params.paymentId || "uncategorized";
    return {
      folder: `cmp-payments/${paymentId}`,
      allowed_formats: ["pdf"],
      resource_type: "raw",
    };
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // PRD Requirement: PDF-only support
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

export const uploadContractFile = multer({
  storage: contractStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or DOCX files are allowed"), false);
    }
  },
});

export const uploadPaymentPdf = multer({
  storage: paymentFilesStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

const ticketAttachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => ({
    folder: `cmp-tickets/${req.params.ticketId || "uncategorized"}`,
    resource_type: "raw",
  }),
});

export const uploadTicketAttachment = multer({
  storage: ticketAttachmentStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "text/plain",
      "application/json",
      "application/zip",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("This file type is not supported for ticket attachments"), false);
    }
  },
});

const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || "uncategorized";
    return {
      folder: `cmp-profiles/${userId}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      resource_type: "image",
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
      ],
    };
  },
});

export const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for images
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, PNG, WEBP) are allowed"), false);
    }
  },
});

export default cloudinary;

