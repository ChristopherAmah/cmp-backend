import mongoose from "mongoose";

/**
 * Modern SaaS-friendly Contract Model
 * Designed for enterprise-grade contract management
 */

const contractPartySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      enum: ["client", "vendor", "partner", "supplier"],
      required: true,
    },
    primaryContact: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      title: { type: String, trim: true },
    },
  },
  { _id: false }
);

const contractPricingSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      enum: ["fixed", "recurring", "usage", "tiered", "hybrid"],
      default: "fixed",
    },
    currency: {
      type: String,
      enum: ["USD", "NGN", "EUR", "GBP", "JPY", "CAD", "AUD"],
      default: "USD",
    },
    baseAmount: { type: Number, default: 0 },
    billingCycle: {
      type: String,
      enum: ["one-time", "monthly", "quarterly", "annually", "custom"],
      default: "one-time",
    },
    renewalTerms: {
      autoRenew: { type: Boolean, default: false },
      noticePeriodDays: { type: Number, default: 30 },
      renewalType: {
        type: String,
        enum: ["automatic", "manual", "conditional"],
        default: "manual",
      },
    },
    paymentTerms: {
      netDays: { type: Number, default: 30 },
      earlyPaymentDiscount: { type: Number, default: 0 },
      latePaymentFee: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const contractTimelineSchema = new mongoose.Schema(
  {
    effectiveDate: { type: Date, required: true },
    expirationDate: { type: Date },
    signedDate: { type: Date },
    terminationDate: { type: Date },
    renewalDate: { type: Date },
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    // Core identification
    contractNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        "service",
        "license",
        "consulting",
        "maintenance",
        "support",
        "procurement",
        "nda",
        "msa",
        "sow",
        "other",
      ],
      default: "service",
      index: true,
    },

    // Parties
    parties: [contractPartySchema],

    // Pricing & Financials
    pricing: { type: contractPricingSchema, required: true },

    // Timeline
    timeline: { type: contractTimelineSchema, required: true },

    // Status & Lifecycle
    status: {
      type: String,
      enum: [
        "draft",
        "pending_signature",
        "active",
        "expired",
        "terminated",
        "renewed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
      index: true,
    },

    // Metadata
    tags: [{ type: String, trim: true }],
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Compliance & Governance
    compliance: {
      requiresReview: { type: Boolean, default: false },
      reviewFrequency: {
        type: String,
        enum: ["monthly", "quarterly", "annually", "never"],
        default: "annually",
      },
      lastReviewDate: { type: Date },
      nextReviewDate: { type: Date },
      regulatoryRequirements: [{ type: String }],
    },

    // Audit trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    signedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        signedAt: { type: Date, default: Date.now },
      },
    ],

    // Soft delete
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
contractSchema.index({ status: 1, isArchived: 1 });
contractSchema.index({ "timeline.effectiveDate": 1, "timeline.expirationDate": 1 });
contractSchema.index({ category: 1, status: 1 });
contractSchema.index({ priority: 1, status: 1 });
contractSchema.index({ createdAt: -1 });
contractSchema.index({ contractNumber: 1 });

// Virtual for contract duration
contractSchema.virtual("duration").get(function () {
  if (this.timeline?.effectiveDate && this.timeline?.expirationDate) {
    const diff = this.timeline.expirationDate - this.timeline.effectiveDate;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)); // days
  }
  return null;
});

// Virtual for days until expiration
contractSchema.virtual("daysUntilExpiration").get(function () {
  if (this.timeline?.expirationDate) {
    const diff = this.timeline.expirationDate - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Method to generate contract number
contractSchema.statics.generateContractNumber = async function () {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    contractNumber: { $regex: `^CON-${year}-` },
  });
  return `CON-${year}-${String(count + 1).padStart(5, "0")}`;
};

// Pre-save middleware to generate contract number
contractSchema.pre("save", async function (next) {
  if (!this.contractNumber) {
    this.contractNumber = await this.constructor.generateContractNumber();
  }
  next();
});

const ContractV3 = mongoose.model("ContractV3", contractSchema);

export default ContractV3;