import Ticket from "../models/Ticket.js";
import TicketComment from "../models/TicketComment.js";

const format = (comment) => ({ id: comment._id.toString(), body: comment.body, createdAt: comment.createdAt.toISOString(), author: { name: comment.author.name, role: comment.author.role } });
const canComment = (user) => ["admin", "super_admin", "developer"].includes(user.role);

export const getComments = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });
    const comments = await TicketComment.find({ ticket: ticket._id }).populate("author", "name role").sort({ createdAt: 1 });
    res.json({ status: "success", data: comments.map(format) });
  } catch (error) { res.status(500).json({ status: "error", message: error.message }); }
};

export const createComment = async (req, res) => {
  try {
    if (!canComment(req.user)) return res.status(403).json({ status: "error", message: "Only admins and developers can comment" });
    if (!req.body.body?.trim()) return res.status(400).json({ status: "error", message: "Comment text is required" });
    const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });
    const comment = await TicketComment.create({ ticket: ticket._id, author: req.user._id, body: req.body.body.trim() });
    await comment.populate("author", "name role");
    res.status(201).json({ status: "success", data: format(comment) });
  } catch (error) { res.status(500).json({ status: "error", message: error.message }); }
};
