import Ticket from '../models/Ticket.js';
import Notification from "../models/Notification.js";

const formatTicketResponse = (ticket) => ({
  id: ticket.ticketId,
  subject: ticket.subject,
  description: ticket.description,
  priority: ticket.priority,
  category: ticket.category,
  status: ticket.status,
  assignedTo: ticket.assignedTo,
  sla: ticket.sla,
  customer: ticket.customer,
  type: ticket.type,
  developer: ticket.developer,
  created: ticket.createdAt.toISOString().slice(0, 10),
  createdAt: ticket.createdAt.toISOString(),
  contract: ticket.contract,
  product: ticket.product,
  module: ticket.module,
  channel: ticket.channel,
});

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
      category,
      status: status || 'Open',
      assignedTo: assignedTo || null,
      customer: ticketCustomer,
      type,
      developer: developer || null,
      contract,
      product,
      module,
      channel,
      sla: sla || { label: 'New', state: 'ok' },
    });

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
