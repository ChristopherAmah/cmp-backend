import mongoose from "mongoose";

const financialAuditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["Invoice", "Payment", "Receipt"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "INVOICE_CREATED",
        "INVOICE_ISSUED",
        "INVOICE_UPDATED",
        "INVOICE_CANCELLED",
        "PAYMENT_RECORDED",
        "PAYMENT_UPDATED",
        "RECEIPT_UPLOADED",
        "RECEIPT_DELETED",
      ],
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    }, // e.g. { amount, currency, previousStatus, newStatus }
  },
  { timestamps: true }
);

financialAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
financialAuditLogSchema.index({ action: 1, createdAt: -1 });

const FinancialAuditLog = mongoose.model(
  "FinancialAuditLog",
  financialAuditLogSchema
);

export default FinancialAuditLog;
