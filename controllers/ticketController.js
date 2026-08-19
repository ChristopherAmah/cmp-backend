import Ticket from '../models/Ticket.js';
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendMail } from "../services/mailer.js";

const asArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return value ? [String(value)] : [];
};

const formatTicketResponse = (ticket) => ({
  id: ticket.ticketId,
  subject: ticket.subject,
  description: ticket.description,
  priority: ticket.priority,
  category: ticket.type || ticket.category,
  status: ticket.status,
  assignedTo: asArray(ticket.assignedTo),
  sla: ticket.sla,
  customer: ticket.customer,
  type: ticket.type,
  developer: asArray(ticket.developer || ticket.assignedTo),
  created: ticket.createdAt.toISOString().slice(0, 10),
  createdAt: ticket.createdAt.toISOString(),
  contract: ticket.contract,
  product: ticket.product,
  module: ticket.module,
  channel: ticket.channel,
});

const notifyNewAssignees = async (ticket, previousAssignees) => {
  const currentAssignees = asArray(ticket.assignedTo);
  const previous = new Set(asArray(previousAssignees));
  const newAssignees = currentAssignees.filter((name) => !previous.has(name));
  if (!newAssignees.length) return;

  const developers = await User.find({
    role: "developer",
    name: { $in: newAssignees },
  }).select("name email").lean();

  await Promise.allSettled(
    developers.map((developer) =>
      sendMail({
        to: developer.email,
        subject: `Ticket assigned: ${ticket.ticketId} - ${ticket.subject}`,
        html: `<p>Hello ${developer.name},</p><p>You have been assigned to ticket <strong>${ticket.ticketId}</strong>: ${ticket.subject}.</p><p>Priority: ${ticket.priority}<br />Status: ${ticket.status}</p>`,
      }).catch((error) =>
        console.error(`Unable to email ${developer.email}:`, error.message),
      ),
    ),
  );
};

export const getTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      data: tickets.map(formatTicketResponse),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const allowedUpdates = [
      'subject',
      'description',
      'priority',
      'category',
      'status',
      'assignedTo',
      'customer',
      'type',
      'developer',
      'contract',
      'product',
      'module',
      'channel',
      'sla',
    ];

    const updates = Object.keys(req.body || {}).reduce((acc, key) => {
      if (allowedUpdates.includes(key)) {
        acc[key] = req.body[key];
      }
      return acc;
    }, {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid ticket fields were provided for update.',
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "assignedTo")) {
      updates.assignedTo = asArray(updates.assignedTo);
      updates.developer = updates.assignedTo;
    } else if (Object.prototype.hasOwnProperty.call(updates, "developer")) {
      updates.developer = asArray(updates.developer);
      updates.assignedTo = updates.developer;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "type")) {
      updates.category = updates.type;
    }

    const existingTicket = await Ticket.findOne({ ticketId });
    if (!existingTicket) {
      return res.status(404).json({
        status: 'error',
        message: 'Ticket not found',
      });
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    await notifyNewAssignees(ticket, existingTicket.assignedTo);

    res.status(200).json({
      status: 'success',
      data: formatTicketResponse(ticket),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const createTicket = async (req, res) => {
  try {
    const {
      title,
      subject,
      description,
      priority,
      category,
      status,
      assignedTo,
      customer,
      organization,
      type,
      developer,
      contract,
      product,
      module,
      channel,
      sla,
    } = req.body;

    const ticketSubject = title || subject;
    const ticketCustomer = customer || organization;

    if (!ticketSubject || !ticketCustomer || !type || !priority) {
      return res.status(400).json({
        status: 'error',
        message: 'Ticket subject, customer, type, and priority are required',
      });
    }

    const lastTicket = await Ticket.findOne().sort({ createdAt: -1 });
    const lastNumber = lastTicket?.ticketId?.match(/(\d+)$/)
      ? Number(lastTicket.ticketId.match(/(\d+)$/)[1])
      : 0;
    const nextNumber = lastNumber + 1;
    const ticketId = `TK-${String(nextNumber).padStart(5, '0')}`;

    const ticket = await Ticket.create({
      ticketId,
      subject: ticketSubject,
      description,
      priority,
      category: type,
      status: status || 'Open',
      assignedTo: asArray(assignedTo || developer),
      customer: ticketCustomer,
      type,
      developer: asArray(developer || assignedTo),
      contract,
      product,
      module,
      channel,
      sla: sla || { label: 'New', state: 'ok' },
    });

    await notifyNewAssignees(ticket, []);

    try {
      await Notification.create({
        recipient: req.user._id,
        ticket: ticket._id,
        title: "Ticket Created",
        description: `${ticket.ticketId} ${ticket.subject} was created successfully.`,
        category: "System",
      });
    } catch (notificationError) {
      console.error("Ticket was created but its notification could not be saved:", notificationError);
    }

    res.status(201).json({
      status: 'success',
      data: formatTicketResponse(ticket),
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.ticketId) {
      return res.status(409).json({
        status: 'error',
        message: 'Ticket ID conflict, please retry creating the ticket',
      });
    }

    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};
