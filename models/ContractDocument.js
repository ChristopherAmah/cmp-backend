import mongoose from "mongoose";

const contractDocumentSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    documentName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ["Contract", "Invoice", "Receipt", "Other"],
      default: "Other",
    },
    cloudinaryId: { type: String },
    cloudinaryUrl: { type: String, required: true },
    originalFileName: { type: String, trim: true },
    fileSize: { type: Number },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

contractDocumentSchema.index({ contract: 1, createdAt: -1 });

const ContractDocument = mongoose.model(
  "ContractDocument",
  contractDocumentSchema
);

export default ContractDocument;
