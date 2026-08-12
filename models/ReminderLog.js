import mongoose from "mongoose";

const reminderLogSchema = new mongoose.Schema(
  {
    paymentSchedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentSchedule",
      required: true,
      index: true,
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    reminderType: {
      type: String,
      enum: ["BEFORE_DUE", "ON_DUE", "AFTER_DUE"],
      required: true,
      index: true,
    },
    daysOffset: { type: Number, required: true },
    recipients: {
      to: [{ type: String, trim: true, lowercase: true }],
      cc: [{ type: String, trim: true, lowercase: true }],
    },
    status: {
      type: String,
      enum: ["SENT", "FAILED"],
      required: true,
      index: true,
    },
    errorMessage: { type: String, trim: true },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

reminderLogSchema.index({
  paymentSchedule: 1,
  reminderType: 1,
  daysOffset: 1,
  sentAt: -1,
});

const ReminderLog = mongoose.model("ReminderLog", reminderLogSchema);

export default ReminderLog;
