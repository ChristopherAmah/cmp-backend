import ReminderLog from "../models/ReminderLog.js";
import { runRemindersOnce } from "../services/remindersJob.js";

export const getReminderLogs = async (req, res) => {
  try {
    const { contractId, paymentScheduleId, status, reminderType, limit } =
      req.query;

    const query = {};
    if (contractId) query.contract = contractId;
    if (paymentScheduleId) query.paymentSchedule = paymentScheduleId;
    if (status) query.status = status;
    if (reminderType) query.reminderType = reminderType;

    const max = Math.min(Number(limit || 100), 500);

    const logs = await ReminderLog.find(query)
      .sort({ sentAt: -1 })
      .limit(max)
      .lean();

    res.status(200).json({
      status: "success",
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const runReminders = async (req, res) => {
  try {
    await runRemindersOnce();
    res
      .status(200)
      .json({ status: "success", message: "Reminders run completed" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};
