import Notification from "../models/Notification.js";

const formatNotification = (notification) => ({
  id: notification._id.toString(),
  title: notification.title,
  description: notification.description,
  category: notification.category,
  delivery: notification.delivery,
  isRead: notification.isRead,
  createdAt: notification.createdAt.toISOString(),
  ticketId: notification.ticket?.ticketId || null,
});

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate("ticket", "ticketId")
      .sort({ createdAt: -1 });
    res.status(200).json({ status: "success", data: notifications.map(formatNotification) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    ).populate("ticket", "ticketId");
    if (!notification) {
      return res.status(404).json({ status: "error", message: "Notification not found" });
    }
    res.status(200).json({ status: "success", data: formatNotification(notification) });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ status: "error", message: "Notification not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
