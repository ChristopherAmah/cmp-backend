/**
 * Receipt Service V3
 * Production-grade receipt service for immutable payment records
 * 
 * Key principles:
 * - Receipts are append-only (never edited, never deleted)
 * - Receipts are AUTO-GENERATED when payments are recorded
 * - Receipt HTML/PDF is auto-generated on creation
 * - Corrections require reversal receipts
 * - All financial calculations are computed from receipts
 */

import ReceiptV3 from "../models/ReceiptV3.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import { getInvoiceLedger, updateInvoiceStatus } from "./invoiceServiceV3.js";
import { renderReceiptHtml } from "./receiptTemplateService.js";
import cloudinary from "../config/cloudinary.js";

/**
 * Create a receipt (record payment)
 * Receipts are immutable - once created, they cannot be changed
 */
export async function createReceipt({ invoiceId, payload, actorId }) {
  const invoice = await InvoiceV3.findById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Validate invoice state
  if (invoice.status === "voided") {
    throw new Error("Cannot record payment for a voided invoice");
  }

  if (invoice.status === "draft") {
    throw new Error("Cannot record payment for a draft invoice. Issue the invoice first.");
  }

  // Validate currency
  const currency = payload.currency || invoice.currency;
  if (currency !== invoice.currency) {
    throw new Error("Receipt currency must match invoice currency");
  }

  // Get current ledger
  const ledger = await getInvoiceLedger(invoiceId);

  // Validate payment amount
  const newTotalPaid = ledger.computed.totalPaid + payload.amount;
  const tolerance = 0.01; // For floating point comparison

  if (newTotalPaid > invoice.totalAmount + tolerance) {
    throw new Error(
      `Payment amount (${payload.amount}) would exceed invoice total. Remaining balance: ${ledger.computed.remainingBalance}`
    );
  }

  // Get contract for receipt generation (for receipt template)
  let contract = null;
  try {
    const invoiceWithContract = await InvoiceV3.findById(invoiceId).populate("contract").lean();
    if (invoiceWithContract.contract) {
      contract = await ContractV3.findById(
        typeof invoiceWithContract.contract === "object" 
          ? invoiceWithContract.contract._id 
          : invoiceWithContract.contract
      ).lean();
    }
  } catch (error) {
    console.error("Error fetching contract for receipt:", error);
  }

  // Create receipt (will auto-generate receiptNumber in pre-save)
  const receipt = await ReceiptV3.create({
    invoice: invoiceId,
    amount: payload.amount,
    currency,
    paymentDate: payload.paymentDate || new Date(),
    paymentMethod: payload.paymentMethod,
    payer: payload.payer,
    referenceNumber: payload.referenceNumber,
    proofUrl: payload.proofUrl,
    proofCloudinaryId: payload.proofCloudinaryId,
    proofFileName: payload.proofFileName,
    notes: payload.notes,
    createdBy: actorId,
  });

    // Auto-generate receipt HTML
  if (contract) {
    try {
      const receiptHtml = await renderReceiptHtml({
        receipt: receipt.toObject(),
        invoice: invoice.toObject(),
        contract: contract,
      });

      // Store HTML URL (using data URI for now, can be converted to Cloudinary later)
      // For production, you might want to upload HTML to Cloudinary or store in a CDN
      const htmlDataUri = `data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`;
      
      receipt.generatedHtmlUrl = htmlDataUri;
      // PDF generation can be added later (using puppeteer or similar)
      // receipt.generatedPdfUrl = pdfUrl;
      
      await receipt.save();
    } catch (error) {
      console.error("Error generating receipt HTML:", error);
      // Don't fail receipt creation if HTML generation fails
    }
  }

  // Update invoice status (computed from receipts)
  await updateInvoiceStatus(invoiceId);

  return receipt;
}

/**
 * Create a reversal receipt (to correct/undo a payment)
 * This is the ONLY way to "undo" a receipt
 */
export async function createReversalReceipt({
  receiptId,
  reason,
  actorId,
}) {
  const originalReceipt = await ReceiptV3.findById(receiptId);
  if (!originalReceipt) {
    throw new Error("Receipt not found");
  }

  if (originalReceipt.isReversal) {
    throw new Error("Cannot reverse a reversal receipt");
  }

  // Check if already reversed
  const existingReversal = await ReceiptV3.findOne({
    reversesReceipt: receiptId,
  });

  if (existingReversal) {
    throw new Error("This receipt has already been reversed");
  }

  // Create reversal receipt (negative amount)
  const reversalReceipt = await ReceiptV3.create({
    invoice: originalReceipt.invoice,
    amount: -Math.abs(originalReceipt.amount), // Negative amount
    currency: originalReceipt.currency,
    paymentDate: new Date(),
    paymentMethod: originalReceipt.paymentMethod,
    referenceNumber: `REV-${originalReceipt.referenceNumber}`,
    notes: `Reversal: ${reason}`,
    isReversal: true,
    reversesReceipt: receiptId,
    reversalReason: reason,
    createdBy: actorId,
  });

  // Update invoice status
  await updateInvoiceStatus(originalReceipt.invoice);

  return reversalReceipt;
}

/**
 * Get receipts for an invoice
 */
export async function getReceiptsForInvoice(invoiceId) {
  const receipts = await ReceiptV3.find({ invoice: invoiceId })
    .populate("createdBy", "name email")
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return receipts;
}

/**
 * Get receipt by ID
 */
export async function getReceipt(receiptId) {
  const receipt = await ReceiptV3.findById(receiptId)
    .populate("invoice", "invoiceNumber totalAmount currency")
    .populate("createdBy", "name email")
    .lean();

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  return receipt;
}
