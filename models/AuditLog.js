import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      enum: ["super_admin", "admin", "developer", "user"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    }, // e.g., "CONTRACT_CREATED", "INVOICE_DELETED", "USER_UPDATED"
    resourceType: {
      type: String,
      required: true,
      index: true,
    }, // e.g., "Contract", "Invoice", "Organization", "User", "Document"
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    resourceName: {
      type: String,
    }, // Human-readable name of the resource
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    }, // Additional context like old values, new values, etc.
    status: {
      type: String,
      enum: ["success", "failure", "pending"],
      default: "success",
      index: true,
    },
    errorMessage: {
      type: String,
    }, // If action failed
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ userRole: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
// Index for super admin notifications (recent critical/high severity actions)
auditLogSchema.index({ severity: 1, createdAt: -1 }, {
  partialFilterExpression: { severity: { $in: ["high", "critical"] } }
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
