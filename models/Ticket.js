import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Low',
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
      trim: true,
    },
    assignedTo: {
      type: [String],
      default: [],
    },
    customer: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    developer: {
      type: [String],
      default: [],
    },
    contract: {
      type: String,
      trim: true,
    },
    product: {
      type: String,
      trim: true,
    },
    module: {
      type: String,
      trim: true,
    },
    channel: {
      type: String,
      trim: true,
    },
    sla: {
      label: {
        type: String,
        trim: true,
        default: 'New',
      },
      state: {
        type: String,
        enum: ['ok', 'warn', 'breached'],
        default: 'ok',
      },
    },
  },
  {
    timestamps: true,
  }
);

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
