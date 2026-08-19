import Ticket from "../models/Ticket.js";
import TicketAttachment from "../models/TicketAttachment.js";

const formatAttachmentResponse = (attachment) => ({
  id: attachment._id.toString(),
  name: attachment.fileName,
  type: attachment.fileType || "application/octet-stream",
  size: attachment.fileSize || 0,
  url: attachment.cloudinaryUrl,
  uploadedBy: attachment.uploadedBy?.name || "Unknown user",
  uploadedAt: attachment.createdAt,
});

const findTicket = (ticketId) => Ticket.findOne({ ticketId }).select("_id").lean();

export const getTicketAttachments = async (req, res) => {
  try {
    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const attachments = await TicketAttachment.find({ ticket: ticket._id })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: attachments.map(formatAttachmentResponse) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const uploadTicketAttachmentFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: "error", message: "Please select a file to upload" });

    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const attachment = await TicketAttachment.create({
      ticket: ticket._id,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size || req.file.bytes,
      cloudinaryId: req.file.public_id || req.file.filename,
      cloudinaryUrl: req.file.secure_url || req.file.path,
      uploadedBy: req.user._id,
    });

    const populatedAttachment = await TicketAttachment.findById(attachment._id).populate("uploadedBy", "name");
    res.status(201).json({ status: "success", data: formatAttachmentResponse(populatedAttachment) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message || "Attachment upload failed" });
  }
};

export const downloadTicketAttachment = async (req, res) => {
  try {
    const ticket = await findTicket(req.params.ticketId);
    if (!ticket) return res.status(404).json({ status: "error", message: "Ticket not found" });

    const attachment = await TicketAttachment.findOne({ _id: req.params.attachmentId, ticket: ticket._id });
    if (!attachment) return res.status(404).json({ status: "error", message: "Attachment not found" });

    res.redirect(attachment.cloudinaryUrl);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
