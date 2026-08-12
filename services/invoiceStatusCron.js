import cron from "node-cron";
import InvoiceV3 from "../models/InvoiceV3.js";
import ReceiptV3 from "../models/ReceiptV3.js";

/**
 * Invoice Status Cron Job
 * Automatically updates invoice statuses based on due dates and payments
 * Runs every hour to catch overdue invoices
 */

/**
 * Compute the correct status for an invoice based on payments and due date
 */
async function computeInvoiceStatus(invoice) {
  // Get all non-reversal receipts for this invoice
  const receipts = await ReceiptV3.find({
    invoice: invoice._id,
    isReversal: false,
  }).lean();
  
  // Calculate total paid
  const totalPaid = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const remainingBalance = Math.max(0, invoice.totalAmount - totalPaid);
  
  // Determine status
  if (invoice.status === "voided") return "voided";
  if (invoice.status === "draft") return "draft";
  
  // Check if fully paid
  if (totalPaid >= invoice.totalAmount - 0.01) {
    return "paid";
  }
  
  // Check if partially paid
  if (totalPaid > 0) {
    // Check if overdue
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      return "overdue";
    }
    return "partially_paid";
  }
  
  // No payments made
  if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
    return "overdue";
  }
  
  return "issued";
}

/**
 * Update overdue invoices
 * Finds all issued/partially_paid invoices past due date and marks them overdue
 */
export async function updateOverdueInvoices() {
  const now = new Date();
  
  try {
    // Find invoices that should be checked
    const invoices = await InvoiceV3.find({
      status: { $in: ["issued", "partially_paid"] },
      dueDate: { $lt: now },
    }).lean();
    
    let updated = 0;
    
    for (const invoice of invoices) {
      const correctStatus = await computeInvoiceStatus(invoice);
      
      if (correctStatus !== invoice.status) {
        await InvoiceV3.findByIdAndUpdate(invoice._id, {
          status: correctStatus,
          updatedAt: now,
        });
        updated++;
        console.log(`[InvoiceStatusCron] Updated invoice ${invoice.invoiceNumber} from ${invoice.status} to ${correctStatus}`);
      }
    }
    
    if (updated > 0) {
      console.log(`[InvoiceStatusCron] Updated ${updated} invoice(s) to overdue status`);
    }
    
    return { checked: invoices.length, updated };
  } catch (error) {
    console.error("[InvoiceStatusCron] Error updating overdue invoices:", error);
    throw error;
  }
}

/**
 * Sync all invoice statuses
 * Useful for initial migration or data consistency checks
 */
export async function syncAllInvoiceStatuses() {
  try {
    const invoices = await InvoiceV3.find({
      status: { $nin: ["draft", "voided"] },
    }).lean();
    
    let updated = 0;
    
    for (const invoice of invoices) {
      const correctStatus = await computeInvoiceStatus(invoice);
      
      if (correctStatus !== invoice.status) {
        await InvoiceV3.findByIdAndUpdate(invoice._id, {
          status: correctStatus,
        });
        updated++;
      }
    }
    
    console.log(`[InvoiceStatusCron] Synced ${updated} of ${invoices.length} invoices`);
    return { total: invoices.length, updated };
  } catch (error) {
    console.error("[InvoiceStatusCron] Error syncing invoice statuses:", error);
    throw error;
  }
}

/**
 * Start the cron job
 * Runs every hour at minute 0
 */
export function startInvoiceStatusCron() {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("[InvoiceStatusCron] Running hourly invoice status check...");
    try {
      await updateOverdueInvoices();
    } catch (error) {
      console.error("[InvoiceStatusCron] Cron job failed:", error);
    }
  });
  
  console.log("[InvoiceStatusCron] Scheduled hourly invoice status updates");
  
  // Also run immediately on startup
  updateOverdueInvoices().catch(console.error);
}

export default {
  updateOverdueInvoices,
  syncAllInvoiceStatuses,
  startInvoiceStatusCron,
};
