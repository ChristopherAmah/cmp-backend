import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Assignment", "SLA Alert", "Status Change", "Comment", "System"],
      default: "System",
    },
    delivery: {
      type: String,
      enum: ["delivered", "failed"],
      default: "delivered",
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
