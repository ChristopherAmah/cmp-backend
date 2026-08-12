import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    documentName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: [
        "SLA",
        "SOW",
        "Co-location",
        "NDA",
        "Contract",
        "Amendment",
        "Other",
      ],
      default: "Other",
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Optional link to a specific contract
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContractV3",
      index: true,
    },
    cloudinaryId: { type: String },
    cloudinaryUrl: { type: String, required: true },
    fileSize: { type: Number },
    fileType: { type: String },
    startDate: { type: Date },
    expiryDate: { type: Date },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

documentSchema.index({ organization: 1, createdAt: -1 });

const Document = mongoose.model("Document", documentSchema);

export default Document;
