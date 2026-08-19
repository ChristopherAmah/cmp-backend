import mongoose from "mongoose";

const ticketTaskSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: 240,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    assignee: {
      type: String,
      required: [true, "A developer must be assigned"],
      trim: true,
    },
    assigneeEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    done: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

ticketTaskSchema.index({ ticket: 1, createdAt: 1 });

const TicketTask = mongoose.model("TicketTask", ticketTaskSchema);

export default TicketTask;
