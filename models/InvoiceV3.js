import mongoose from "mongoose";

/**
 * Invoice V3 Model
 * Production-grade invoice model with computed balances and statuses
 * 
 * Key principles:
 * - NO stored paid_amount or balance (computed from receipts)
 * - Status is computed, not stored
 * - References ContractV3
 */

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 1, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    // Contract reference (required)
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContractV3",
      required: true,
    },

    // Invoice identification
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
    },

    // Dates
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true, index: true },

    // Line items and amounts
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Invoice must have at least one line item",
      },
    },

    // Financial amounts (stored, computed from line items)
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 }, // Percentage
    taxAmount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    // Currency
    currency: {
      type: String,
      enum: ["USD", "NGN", "EUR", "GBP", "JPY", "CAD", "AUD"],
      required: true,
      default: "USD",
    },

    // Status (stored for indexing, but computed on read)
    // Note: Status is computed from receipts + dates, but stored for querying
    status: {
      type: String,
      enum: ["draft", "issued", "partially_paid", "paid", "overdue", "voided"],
      default: "draft",
      index: true,
    },

    // Void information (if voided)
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, trim: true },

    // Notes
    notes: { type: String, trim: true },

    // Generated document URLs (populated by document generation service)
    generatedPdfUrl: { type: String },
    generatedHtmlUrl: { type: String },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

// Indexes
invoiceSchema.index({ contract: 1, status: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ createdAt: -1 });

// Pre-save: Calculate totals from line items
invoiceSchema.pre("save", async function (next) {
  // Generate invoice number if not provided (generates when created or when issued)
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      invoiceNumber: { $regex: `^INV-${year}-` },
    });
    this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, "0")}`;
  }

  // Calculate totals from line items
  if (this.lineItems && this.lineItems.length > 0) {
    // Calculate subtotal
    this.subtotal = this.lineItems.reduce((sum, item) => {
      return sum + (item.total || item.quantity * item.unitPrice || 0);
    }, 0);

    // Calculate tax
    this.taxAmount = ((this.subtotal - this.discount) * this.taxRate) / 100;

    // Calculate total
    this.totalAmount = this.subtotal - this.discount + this.taxAmount;
  }

  next();
});

const InvoiceV3 = mongoose.model("InvoiceV3", invoiceSchema);

export default InvoiceV3;
