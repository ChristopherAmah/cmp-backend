import cron from "node-cron";
import ContractV3 from "../models/ContractV3.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import ReminderLog from "../models/ReminderLog.js";
import ContractActivityLog from "../models/ContractActivityLog.js";
import { sendMail } from "./mailer.js";

const DEFAULT_OFFSETS = [14, 7, 0, -7];

const buildEmailHtml = ({ companyName, contractName, amount, dueDate }) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Payment Reminder</h2>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Contract:</strong> ${contractName}</p>
      <p><strong>Amount:</strong> ${amount}</p>
      <p><strong>Due Date:</strong> ${new Date(
        dueDate
      ).toLocaleDateString()}</p>
      <p>This is an automated reminder from Fifthlab CMP.</p>
    </div>
  `;
};

const daysBetween = (a, b) => {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
};

const getReminderType = (offset) => {
  if (offset > 0) return "BEFORE_DUE";
  if (offset === 0) return "ON_DUE";
  return "AFTER_DUE";
};

const logActivity = async ({ contractId, actor, message, metadata }) => {
  try {
    await ContractActivityLog.create({
      contract: contractId,
      action: "REMINDER_SENT",
      actor,
      message,
      metadata,
    });
  } catch (e) {
    // ignore
  }
};

const alreadySent = async ({
  paymentScheduleId,
  reminderType,
  daysOffset,
  dayStart,
  dayEnd,
}) => {
  const count = await ReminderLog.countDocuments({
    paymentSchedule: paymentScheduleId,
    reminderType,
    daysOffset,
    sentAt: { $gte: dayStart, $lte: dayEnd },
    status: "SENT",
  });

  return count > 0;
};

export const runRemindersOnce = async () => {
  // TODO: Refactor to use InvoiceV3 due dates instead of old PaymentSchedule model
  // The V3 architecture uses invoices with dueDate field directly
  console.log("[Reminders] Reminder job placeholder - needs V3 refactor");
};

export const startRemindersCron = () => {
  const enabled = process.env.REMINDERS_ENABLED === "true";
  if (!enabled) return null;

  const schedule = process.env.REMINDERS_CRON || "0 9 * * *";

  return cron.schedule(schedule, async () => {
    try {
      await runRemindersOnce();
    } catch (e) {
      // ignore
    }
  });
};
