import mongoose from "mongoose";

/**
 * GeneratedDocument Model
 * Tracks all system-generated PDFs and HTMLs for invoices and receipts
 * Supports versioning and full audit trail
 */

const generatedDocumentSchema = new mongoose.Schema(
  {
    // Entity reference (polymorphic)
    entityType: {
      type: String,
      enum: ["invoice", "receipt"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityModel",
      index: true,
    },
    entityModel: {
      type: String,
      enum: ["InvoiceV3", "ReceiptV3"],
      required: true,
    },

    // Document identification
    documentNumber: {
      type: String,
      trim: true,
      index: true,
    },

    // Version tracking
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isLatest: {
      type: Boolean,
      default: true,
      index: true,
    },

    // File information
    format: {
      type: String,
      enum: ["pdf", "html"],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },

    // Storage
    cloudinaryId: {
      type: String,
      index: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    secureUrl: {
      type: String,
    },

    // Generation metadata
    templateVersion: {
      type: String,
      default: "1.0",
    },
    generationReason: {
      type: String,
      enum: ["initial", "update", "regenerate", "correction"],
      default: "initial",
    },

    // Audit trail
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
generatedDocumentSchema.index({ entityType: 1, entityId: 1, isLatest: 1 });
generatedDocumentSchema.index({ entityType: 1, entityId: 1, format: 1, version: -1 });
generatedDocumentSchema.index({ generatedAt: -1 });

// Static method to get latest document for an entity
generatedDocumentSchema.statics.getLatest = async function (entityType, entityId, format = "pdf") {
  return this.findOne({
    entityType,
    entityId,
    format,
    isLatest: true,
    isDeleted: false,
  }).sort({ version: -1 });
};

// Static method to get all versions for an entity
generatedDocumentSchema.statics.getVersionHistory = async function (entityType, entityId, format = "pdf") {
  return this.find({
    entityType,
    entityId,
    format,
    isDeleted: false,
  })
    .sort({ version: -1 })
    .populate("generatedBy", "name email");
};

// Pre-save: Mark previous versions as not latest
generatedDocumentSchema.pre("save", async function (next) {
  if (this.isNew && this.isLatest) {
    await this.constructor.updateMany(
      {
        entityType: this.entityType,
        entityId: this.entityId,
        format: this.format,
        _id: { $ne: this._id },
      },
      { isLatest: false }
    );
  }
  next();
});

const GeneratedDocument = mongoose.model("GeneratedDocument", generatedDocumentSchema);

export default GeneratedDocument;
