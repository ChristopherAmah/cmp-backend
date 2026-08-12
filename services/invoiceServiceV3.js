/**
 * Invoice Service V3
 * Production-grade invoice service with computed balances and ledger logic
 * 
 * Key principles:
 * - All balances are computed, never stored
 * - Status is derived from receipts + dates
 * - Single source of truth: invoice.totalAmount
 */

import InvoiceV3 from "../models/InvoiceV3.js";
import ReceiptV3 from "../models/ReceiptV3.js";
import ContractV3 from "../models/ContractV3.js";

/**
 * Compute invoice ledger (invoice + receipts + computed balances)
 * This is the single source of truth for invoice financial state
 */
export async function getInvoiceLedger(invoiceId) {
  const [invoice, receipts] = await Promise.all([
    InvoiceV3.findById(invoiceId).lean(),
    ReceiptV3.find({ invoice: invoiceId, isReversal: false })
      .sort({ paymentDate: 1 })
      .lean(),
  ]);

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Compute paid amount from receipts (exclude reversals)
  const totalPaid = receipts.reduce((sum, receipt) => {
    return sum + (receipt.amount || 0);
  }, 0);

  // Compute remaining balance
  const remainingBalance = Math.max(0, invoice.totalAmount - totalPaid);

  // Compute status
  const status = computeInvoiceStatus({
    invoice,
    totalPaid,
    now: new Date(),
  });

  return {
    invoice,
    receipts,
    computed: {
      totalPaid,
      remainingBalance,
      status,
      isFullyPaid: totalPaid >= invoice.totalAmount - 0.01, // Account for floating point
      isOverdue: status === "overdue",
    },
  };
}

/**
 * Compute invoice status from receipts and dates
 * Status is DERIVED, never manually set
 */
export function computeInvoiceStatus({ invoice, totalPaid, now = new Date() }) {
  // Voided invoices stay voided
  if (invoice.status === "voided") {
    return "voided";
  }

  // Draft invoices stay draft (not issued yet)
  if (invoice.status === "draft") {
    return "draft";
  }

  // If fully paid
  if (totalPaid >= invoice.totalAmount - 0.01) {
    return "paid";
  }

  // If partially paid
  if (totalPaid > 0) {
    // Check if overdue
    if (invoice.dueDate && new Date(invoice.dueDate) < now) {
      return "overdue";
    }
    return "partially_paid";
  }

  // If not paid yet
  if (invoice.dueDate && new Date(invoice.dueDate) < now) {
    return "overdue";
  }

  // Issued but not yet due
  return "issued";
}

/**
 * Update invoice status based on current receipts
 * Called after receipt creation/deletion
 */
export async function updateInvoiceStatus(invoiceId) {
  const ledger = await getInvoiceLedger(invoiceId);
  
  // Update stored status (for indexing/querying)
  // The computed status is always the source of truth
  await InvoiceV3.findByIdAndUpdate(invoiceId, {
    status: ledger.computed.status,
  });

  return ledger.computed.status;
}

/**
 * Create invoice from contract
 */
export async function createInvoice({ contractId, payload, actorId }) {
  const contract = await ContractV3.findById(contractId);
  if (!contract) {
    throw new Error("Contract not found");
  }

  // Only active contracts can have invoices
  if (contract.status !== "active") {
    throw new Error("Can only create invoices for active contracts");
  }

  // Calculate totals
  const lineItems = payload.lineItems.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const total = quantity * unitPrice;
    return {
      ...item,
      quantity,
      unitPrice,
      total,
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = payload.taxRate ?? contract.pricing?.defaultTaxRate ?? 0;
  const discount = payload.discount || 0;
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const totalAmount = subtotal - discount + taxAmount;

  // Validate total invoices don't exceed contract value
  const contractValue = contract.pricing?.baseAmount || 0;
  if (contractValue > 0) {
    const existingInvoices = await InvoiceV3.find({ contract: contractId }).lean();
    const totalInvoiced = existingInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );
    const newTotalInvoiced = totalInvoiced + totalAmount;
    const tolerance = 0.01; // For floating point comparison
    
    if (newTotalInvoiced > contractValue + tolerance) {
      const remaining = Math.max(0, contractValue - totalInvoiced);
      throw new Error(
        `Invoice total amount (${totalAmount.toFixed(2)}) would exceed contract value. ` +
        `Total contract value: ${contractValue.toFixed(2)}, ` +
        `Already invoiced: ${totalInvoiced.toFixed(2)}, ` +
        `Remaining: ${remaining.toFixed(2)}`
      );
    }
  }

  const invoice = await InvoiceV3.create({
    contract: contractId,
    issueDate: payload.issueDate || new Date(),
    dueDate: payload.dueDate,
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    totalAmount,
    currency: payload.currency || contract.pricing?.currency || "USD",
    status: "draft",
    notes: payload.notes,
    createdBy: actorId,
    updatedBy: actorId,
  });

  return invoice;
}

/**
 * Update invoice (only draft invoices can be updated)
 */
export async function updateInvoice({ invoiceId, payload, actorId }) {
  const invoice = await InvoiceV3.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Only draft invoices can be updated
  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be updated");
  }

  const contract = await ContractV3.findById(invoice.contract);
  if (!contract) {
    throw new Error("Contract not found");
  }

  // Calculate totals
  const lineItems = payload.lineItems.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const total = quantity * unitPrice;
    return {
      ...item,
      quantity,
      unitPrice,
      total,
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = payload.taxRate ?? contract.pricing?.defaultTaxRate ?? 0;
  const discount = payload.discount || 0;
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const totalAmount = subtotal - discount + taxAmount;

  // Validate total invoices don't exceed contract value (excluding current invoice)
  const contractValue = contract.pricing?.baseAmount || 0;
  if (contractValue > 0) {
    const existingInvoices = await InvoiceV3.find({ 
      contract: invoice.contract,
      _id: { $ne: invoiceId }
    }).lean();
    const totalInvoiced = existingInvoices.reduce(
      (sum, inv) => sum + (inv.totalAmount || 0),
      0
    );
    const newTotalInvoiced = totalInvoiced + totalAmount;
    const tolerance = 0.01; // For floating point comparison
    
    if (newTotalInvoiced > contractValue + tolerance) {
      const remaining = Math.max(0, contractValue - totalInvoiced);
      throw new Error(
        `Updated invoice total amount (${totalAmount.toFixed(2)}) would exceed contract value. ` +
        `Total contract value: ${contractValue.toFixed(2)}, ` +
        `Other invoices: ${totalInvoiced.toFixed(2)}, ` +
        `Remaining: ${remaining.toFixed(2)}`
      );
    }
  }

  // Update invoice
  invoice.lineItems = lineItems;
  invoice.subtotal = subtotal;
  invoice.taxRate = taxRate;
  invoice.taxAmount = taxAmount;
  invoice.discount = discount;
  invoice.totalAmount = totalAmount;
  invoice.issueDate = payload.issueDate || invoice.issueDate;
  invoice.dueDate = payload.dueDate || invoice.dueDate;
  invoice.notes = payload.notes !== undefined ? payload.notes : invoice.notes;
  invoice.currency = payload.currency || invoice.currency;
  invoice.updatedBy = actorId;
  invoice.updatedAt = new Date();

  await invoice.save();
  return invoice;
}

/**
 * Issue an invoice (change status from draft to issued)
 */
export async function issueInvoice({ invoiceId, actorId }) {
  const invoice = await InvoiceV3.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be issued");
  }

  invoice.status = "issued";
  invoice.issueDate = new Date();
  invoice.updatedBy = actorId;
  await invoice.save();

  return invoice;
}

/**
 * Void an invoice
 */
export async function voidInvoice({ invoiceId, reason, actorId }) {
  const invoice = await InvoiceV3.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new Error("Cannot void a paid invoice");
  }

  if (invoice.status === "voided") {
    throw new Error("Invoice is already voided");
  }

  invoice.status = "voided";
  invoice.voidedAt = new Date();
  invoice.voidedBy = actorId;
  invoice.voidReason = reason;
  invoice.updatedBy = actorId;
  await invoice.save();

  return invoice;
}

/**
 * Get invoice with computed ledger
 */
export async function getInvoiceWithLedger(invoiceId) {
  return await getInvoiceLedger(invoiceId);
}
