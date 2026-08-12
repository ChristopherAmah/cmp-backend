import mongoose from "mongoose";

const contractActivityLogSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATED",
        "UPDATED",
        "STATUS_CHANGE",
        "ARCHIVED",
        "DELETED",
        "PAYMENT_CREATED",
        "PAYMENT_UPDATED",
        "INVOICE_GENERATED",
        "INVOICE_AUTO_GENERATED",
        "RECEIPT_GENERATED",
        "REMINDER_SENT",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_DELETED",
      ],
      index: true,
    },
    fromStatus: { type: String },
    toStatus: { type: String },
    changes: { type: mongoose.Schema.Types.Mixed },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

contractActivityLogSchema.index({ contract: 1, createdAt: -1 });
contractActivityLogSchema.index({ action: 1, createdAt: -1 });

const ContractActivityLog = mongoose.model(
  "ContractActivityLog",
  contractActivityLogSchema
);

export default ContractActivityLog;
