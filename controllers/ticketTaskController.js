import Ticket from "../models/Ticket.js";
import TicketTask from "../models/TicketTask.js";
import User from "../models/User.js";

const formatTaskResponse = (task) => ({
  id: task._id.toString(),
  title: task.title,
  note: task.note || "",
  assignee: task.assignee,
  assigneeEmail: task.assigneeEmail || "",
  done: task.done,
  completedAt: task.completedAt,
  createdAt: task.createdAt,
});

const findTicket = (ticketId) => Ticket.findOne({ ticketId }).select("_id").lean();

export const getTicketTasks = async (req, res) => {
  try {
    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const tasks = await TicketTask.find({ ticket: ticket._id }).sort({ createdAt: 1 });
    res.status(200).json({ status: "success", data: tasks.map(formatTaskResponse) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const createTicketTask = async (req, res) => {
  try {
    const { title, note, assignee } = req.body || {};
    if (!title?.trim() || !assignee?.trim()) {
      return res.status(400).json({ status: "error", message: "Task title and developer assignment are required" });
    }

    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const developer = await User.findOne({ role: "developer", name: assignee.trim() })
      .select("name email")
      .lean();
    if (!developer) {
      return res.status(400).json({ status: "error", message: "Select a valid developer" });
    }

    const task = await TicketTask.create({
      ticket: ticket._id,
      title: title.trim(),
      note: note?.trim() || "",
      assignee: developer.name,
      assigneeEmail: developer.email,
    });
    res.status(201).json({ status: "success", data: formatTaskResponse(task) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const updateTicketTask = async (req, res) => {
  try {
    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const task = await TicketTask.findOne({
      _id: req.params.taskId,
      ticket: ticket._id,
    });
    if (!task) return res.status(404).json({ status: "error", message: "Task not found" });

    if (typeof req.body?.done !== "boolean") {
      return res.status(400).json({ status: "error", message: "Task completion must be true or false" });
    }

    task.done = req.body.done;
    task.completedAt = task.done ? new Date() : null;
    task.completedBy = task.done ? req.user._id : null;
    await task.save();

    res.status(200).json({ status: "success", data: formatTaskResponse(task) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
