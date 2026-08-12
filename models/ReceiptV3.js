import mongoose from "mongoose";

/**
 * Receipt V3 Model
 * Production-grade receipt model - immutable payment records
 * 
 * Key principles:
 * - Append-only (never edited, never deleted)
 * - Direct reference to Invoice
 * - Immutable audit trail
 * - Corrections require reversal receipts
 */

const receiptSchema = new mongoose.Schema(
  {
    // Invoice reference (required)
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvoiceV3",
      required: true,
    },

    // Receipt identification
    receiptNumber: {
      type: String,
      unique: true,
      trim: true,
    },

    // Payment details
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      enum: ["USD", "NGN", "EUR", "GBP", "JPY", "CAD", "AUD"],
      required: true,
    },

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "bank_transfer",
        "cash",
        "card",
        "cheque",
        "wire_transfer",
        "ach",
        "other",
      ],
      required: true,
    },

    // Payer information
    payer: {
      type: String,
      trim: true,
    },

    // Payment reference/proof
    referenceNumber: {
      type: String,
      trim: true,
    },

    // Payment proof (optional file)
    proofUrl: { type: String },
    proofCloudinaryId: { type: String },
    proofFileName: { type: String, trim: true },

    // Auto-generated receipt files
    generatedHtmlUrl: { type: String },
    generatedPdfUrl: { type: String },

    // Notes
    notes: { type: String, trim: true },

    // Reversal information (if this is a reversal receipt)
    isReversal: { type: Boolean, default: false },
    reversesReceipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReceiptV3",
    },
    reversalReason: { type: String, trim: true },

    // Audit trail (immutable)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
receiptSchema.index({ invoice: 1, paymentDate: -1 });
receiptSchema.index({ receiptNumber: 1 });
receiptSchema.index({ referenceNumber: 1 });
receiptSchema.index({ createdAt: -1 });

// Pre-save: Generate receipt number
receiptSchema.pre("save", async function (next) {
  if (!this.receiptNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      receiptNumber: { $regex: `^RCP-${year}-` },
    });
    this.receiptNumber = `RCP-${year}-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

// Prevent updates after creation (immutable) - except for generated document URLs
receiptSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  const allowedFields = ["generatedPdfUrl", "generatedHtmlUrl"];
  const updateFields = Object.keys(update.$set || update);
  
  const hasDisallowedFields = updateFields.some(
    (field) => !allowedFields.includes(field)
  );
  
  if (hasDisallowedFields && !this.options.overwriteImmutable) {
    throw new Error("Receipts cannot be updated. Create a reversal receipt instead.");
  }
});

receiptSchema.pre("updateOne", function () {
  const update = this.getUpdate();
  const allowedFields = ["generatedPdfUrl", "generatedHtmlUrl"];
  const updateFields = Object.keys(update.$set || update);
  
  const hasDisallowedFields = updateFields.some(
    (field) => !allowedFields.includes(field)
  );
  
  if (hasDisallowedFields && !this.options.overwriteImmutable) {
    throw new Error("Receipts cannot be updated. Create a reversal receipt instead.");
  }
});

const ReceiptV3 = mongoose.model("ReceiptV3", receiptSchema);

export default ReceiptV3;
