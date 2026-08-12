import puppeteer from "puppeteer";
import { v2 as cloudinary } from "cloudinary";
import GeneratedDocument from "../models/GeneratedDocument.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import ReceiptV3 from "../models/ReceiptV3.js";
import ContractV3 from "../models/ContractV3.js";
import Organization from "../models/Organization.js";

/**
 * Document Generation Service
 * Handles rendering, PDF generation, and storage of invoices and receipts
 */

// ============================================================================
// FIFTHLAB LOGOS (Base64 encoded)
// ============================================================================

const LOGO_BLACK_BASE64 =
  "data:image/png;base64,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";

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

const formatCurrency = (amount, currency = "USD") => {
  if (amount === null || amount === undefined) return "0.00";

  const locales = {
    USD: "en-US",
    NGN: "en-NG",
    EUR: "de-DE",
    GBP: "en-GB",
    JPY: "ja-JP",
    CAD: "en-CA",
    AUD: "en-AU",
  };

  try {
    return new Intl.NumberFormat(locales[currency] || "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
};

const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ============================================================================
// HTML TEMPLATES
// ============================================================================

/**
 * Render invoice as professional HTML
 */
export function renderInvoiceHtml({
  invoice,
  contract,
  organization,
  computed,
}) {
  console.log("[DEBUG] renderInvoiceHtml called with:");
  console.log("[DEBUG] invoice.status:", invoice.status);
  console.log("[DEBUG] contract.status:", contract?.status);
  console.log("[DEBUG] computed:", computed);

  const status = computed?.status || invoice.status;
  const totalPaid = computed?.totalPaid ?? 0;
  const remainingBalance =
    computed?.remainingBalance ?? invoice.totalAmount - totalPaid;

  console.log(
    "[DEBUG] Final values - status:",
    status,
    "totalPaid:",
    totalPaid,
    "remainingBalance:",
    remainingBalance,
  );

  const statusColors = {
    draft: "#6B7280",
    issued: "#3B82F6",
    partially_paid: "#F59E0B",
    paid: "#10B981",
    overdue: "#EF4444",
    voided: "#6B7280",
  };

  const statusLabels = {
    draft: "DRAFT",
    issued: "ISSUED",
    partially_paid: "PARTIALLY PAID",
    paid: "PAID",
    overdue: "OVERDUE",
    voided: "VOIDED",
  };

  const lineItemsHtml = invoice.lineItems
    .map(
      (item, index) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.unitPrice, invoice.currency)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.total, invoice.currency)}</td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @media print {
      @page {
        size: letter;
        margin: 0.5in;
      }
      body { 
        background: white !important; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact;
        padding: 0 !important;
      }
      .invoice-container { 
        box-shadow: none !important; 
        margin: 0 !important; 
        max-width: 100% !important;
        page-break-inside: avoid;
      }
      .header, .details-section, .items-section, .totals-section, .payment-summary, .notes-section, .footer {
        page-break-inside: avoid;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      color: #1F2937; 
      line-height: 1.4;
      background: #F9FAFB;
      display: flex;
      justify-content: center;
      padding: 20px;
    }
    .invoice-container {
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      page-break-inside: avoid;
    }
    .header {
      background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
      color: white;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      page-break-inside: avoid;
    }
    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .company-info p {
      opacity: 0.9;
      font-size: 12px;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-info h2 {
      font-size: 28px;
      font-weight: 300;
      margin-bottom: 6px;
    }
    .invoice-number {
      font-size: 16px;
      font-weight: 600;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 8px;
      background: ${statusColors[status] || statusColors.draft};
      color: white;
    }
    .details-section {
      padding: 20px 30px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      border-bottom: 1px solid #E5E7EB;
      text-align: left;
      page-break-inside: avoid;
    }
    .detail-box {
      margin-bottom: 12px;
    }
    .detail-box h3 {
      font-size: 10px;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 5px;
      letter-spacing: 0.5px;
    }
    .detail-box p {
      font-size: 12px;
      color: #374151;
      margin: 3px 0;
      line-height: 1.4;
    }
    .detail-box .value {
      font-size: 14px;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 4px;
    }
    .items-section {
      padding: 20px 30px;
      page-break-inside: avoid;
    }
    .items-section h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1F2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      background: #F3F4F6;
      padding: 6px 8px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      color: #6B7280;
      font-weight: 600;
    }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      text-align: right;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #E5E7EB;
      line-height: 1.4;
    }
    .totals-section {
      padding: 0 30px 25px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
    }
    .totals-box {
      width: 280px;
      background: #F9FAFB;
      border-radius: 8px;
      padding: 15px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .totals-row.total {
      border-top: 2px solid #E5E7EB;
      margin-top: 5px;
      padding-top: 10px;
      font-size: 15px;
      font-weight: 700;
      color: #0EA5E9;
    }
    .payment-summary {
      padding: 0 30px 20px;
      page-break-inside: avoid;
    }
    .payment-box {
      background: ${status === "paid" ? "#ECFDF5" : status === "overdue" ? "#FEF2F2" : "#F0F9FF"};
      border-radius: 8px;
      padding: 12px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .payment-item h4 {
      font-size: 10px;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 3px;
    }
    .payment-item .amount {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    .payment-item .amount.paid { color: #10B981; }
    .payment-item .amount.remaining { color: ${remainingBalance > 0 ? "#EF4444" : "#10B981"}; }
    .notes-section {
      padding: 0 30px 25px;
      page-break-inside: avoid;
    }
    .notes-box {
      background: #FFFBEB;
      border-left: 4px solid #F59E0B;
      padding: 10px;
      font-size: 12px;
      color: #92400E;
      line-height: 1.4;
    }
    .footer {
      background: #F3F4F6;
      padding: 12px 30px;
      text-align: center;
      font-size: 10px;
      color: #6B7280;
      page-break-inside: avoid;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <div class="logo-container" style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <img src="${LOGO_BLACK_BASE64}" alt="Fifthlab" style="height: 40px; width: auto; filter: brightness(0) invert(1);" />
        </div>
        ${organization?.name ? `<p style="font-size: 13px; opacity: 0.9; margin-top: 8px;">${organization.name}</p>` : ""}
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <div class="status-badge">${statusLabels[status] || "ACTIVE"}</div>
      </div>
    </div>
    
    <div class="details-section">
      <div>
        <div class="detail-box">
          <h3>Bill To</h3>
          <p class="value">${contract?.title || "Client"}</p>
          ${contract?.parties?.[0]?.primaryContact?.name ? `<p>${contract.parties[0].primaryContact.name}</p>` : ""}
          ${contract?.parties?.[0]?.primaryContact?.email ? `<p>${contract.parties[0].primaryContact.email}</p>` : ""}
          ${contract?.status ? `<p style="margin-top: 8px; font-size: 11px; text-transform: uppercase; color: #6B7280;">Contract Status: <span style="font-weight: 600; color: ${contract.status === "active" ? "#10B981" : "#6B7280"};">${contract.status}</span></p>` : ""}
        </div>
      </div>
      <div>
        <div class="detail-box" style="margin-bottom: 20px;">
          <h3>Issue Date</h3>
          <p class="value">${formatDate(invoice.issueDate)}</p>
        </div>
        <div class="detail-box">
          <h3>Due Date</h3>
          <p class="value">${formatDate(invoice.dueDate)}</p>
        </div>
      </div>
    </div>
    
    <div class="items-section">
      <h3>Line Items</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Description</th>
            <th style="width: 80px;">Qty</th>
            <th style="width: 120px;">Unit Price</th>
            <th style="width: 120px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>
    </div>
    
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
        </div>
        ${
          invoice.discount > 0
            ? `
        <div class="totals-row">
          <span>Discount</span>
          <span>-${formatCurrency(invoice.discount, invoice.currency)}</span>
        </div>
        `
            : ""
        }
        ${
          invoice.taxAmount > 0
            ? `
        <div class="totals-row">
          <span>Tax (${invoice.taxRate}%)</span>
          <span>${formatCurrency(invoice.taxAmount, invoice.currency)}</span>
        </div>
        `
            : ""
        }
        <div class="totals-row total">
          <span>Total</span>
          <span>${formatCurrency(invoice.totalAmount, invoice.currency)}</span>
        </div>
      </div>
    </div>
    
    <div class="payment-summary">
      <div class="payment-box">
        <div class="payment-item">
          <h4>Total Amount</h4>
          <div class="amount">${formatCurrency(invoice.totalAmount, invoice.currency)}</div>
        </div>
        <div class="payment-item">
          <h4>Amount Paid</h4>
          <div class="amount paid">${formatCurrency(totalPaid, invoice.currency)}</div>
        </div>
        <div class="payment-item">
          <h4>Balance Due</h4>
          <div class="amount remaining">${formatCurrency(remainingBalance, invoice.currency)}</div>
        </div>
      </div>
    </div>
    
    ${
      invoice.notes
        ? `
    <div class="notes-section">
      <div class="notes-box">
        <strong>Notes:</strong> ${invoice.notes}
      </div>
    </div>
    `
        : ""
    }
    
    <div class="footer">
      <p>Generated on ${formatDate(new Date())} | Invoice ${invoice.invoiceNumber}</p>
      <p>Thank you for your business!</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Render receipt as professional HTML
 */
export function renderReceiptHtml({
  receipt,
  invoice,
  contract,
  organization,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${receipt.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      color: #1F2937; 
      line-height: 1.6;
      background: #F9FAFB;
    }
    .receipt-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 300;
      margin-bottom: 8px;
    }
    .header .check-icon {
      width: 60px;
      height: 60px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .header .check-icon svg {
      width: 32px;
      height: 32px;
      color: #10B981;
    }
    .receipt-number {
      font-size: 14px;
      opacity: 0.9;
    }
    .amount-section {
      padding: 40px;
      text-align: center;
      border-bottom: 1px solid #E5E7EB;
    }
    .amount-label {
      font-size: 14px;
      color: #6B7280;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 48px;
      font-weight: 700;
      color: #10B981;
    }
    .details-section {
      padding: 40px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #F3F4F6;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #6B7280;
      font-size: 14px;
    }
    .detail-value {
      font-weight: 600;
      color: #1F2937;
      font-size: 14px;
    }
    .invoice-summary {
      background: #F0FDF4;
      margin: 0 40px 40px;
      padding: 20px;
      border-radius: 8px;
    }
    .invoice-summary h3 {
      font-size: 14px;
      color: #059669;
      margin-bottom: 16px;
      text-transform: uppercase;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .summary-row.highlight {
      font-weight: 700;
      color: #059669;
      border-top: 1px solid #A7F3D0;
      padding-top: 12px;
      margin-top: 8px;
    }
    .footer {
      background: #F3F4F6;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="check-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h1>Payment Received</h1>
      <div class="receipt-number">${receipt.receiptNumber}</div>
    </div>
    
    <div class="amount-section">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-value">${formatCurrency(receipt.amount, receipt.currency)}</div>
    </div>
    
    <div class="details-section">
      <div class="detail-row">
        <span class="detail-label">Payment Date</span>
        <span class="detail-value">${formatDate(receipt.paymentDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Method</span>
        <span class="detail-value">${receipt.paymentMethod.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
      </div>
      ${
        receipt.payer
          ? `
      <div class="detail-row">
        <span class="detail-label">Paid By</span>
        <span class="detail-value">${receipt.payer}</span>
      </div>
      `
          : ""
      }
      ${
        receipt.referenceNumber
          ? `
      <div class="detail-row">
        <span class="detail-label">Reference Number</span>
        <span class="detail-value">${receipt.referenceNumber}</span>
      </div>
      `
          : ""
      }
      <div class="detail-row">
        <span class="detail-label">For Invoice</span>
        <span class="detail-value">${invoice?.invoiceNumber || "N/A"}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Contract</span>
        <span class="detail-value">${contract?.title || "N/A"}</span>
      </div>
    </div>
    
    <div class="invoice-summary">
      <h3>Invoice Summary</h3>
      <div class="summary-row">
        <span>Invoice Total</span>
        <span>${formatCurrency(invoice?.totalAmount || 0, receipt.currency)}</span>
      </div>
      <div class="summary-row">
        <span>This Payment</span>
        <span>${formatCurrency(receipt.amount, receipt.currency)}</span>
      </div>
      <div class="summary-row highlight">
        <span>Remaining Balance</span>
        <span>${formatCurrency(Math.max(0, (invoice?.totalAmount || 0) - (receipt.amount || 0)), receipt.currency)}</span>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated on ${formatDate(new Date())}</p>
      <p>${organization?.name || "Company"} | Thank you for your payment!</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Convert HTML to PDF using Puppeteer
 */
export async function htmlToPdf(html) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================================
// CLOUDINARY UPLOAD
// ============================================================================

/**
 * Upload PDF buffer to Cloudinary
 */
export async function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: options.folder || "generated-documents",
        public_id: options.publicId,
        format: "pdf",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      },
    );

    uploadStream.end(buffer);
  });
}

// ============================================================================
// DOCUMENT GENERATION ORCHESTRATION
// ============================================================================

/**
 * Generate and store invoice PDF
 */
export async function generateInvoicePdf(
  invoiceId,
  userId,
  reason = "initial",
) {
  // Fetch invoice with related data
  const invoice = await InvoiceV3.findById(invoiceId)
    .populate("contract")
    .populate("createdBy", "name email")
    .lean();

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Fetch contract details
  const contract = await ContractV3.findById(
    invoice.contract._id || invoice.contract,
  )
    .populate("parties.organizationId")
    .lean();

  // Get organization (first party or contract creator's org)
  let organization = null;
  if (contract?.parties?.[0]?.organizationId) {
    organization = contract.parties[0].organizationId;
  }

  // Get computed ledger data
  const { getInvoiceLedger } = await import("./invoiceServiceV3.js");
  let computed = {};
  try {
    const ledger = await getInvoiceLedger(invoiceId);
    computed = ledger.computed;
  } catch (e) {
    computed = {
      totalPaid: 0,
      remainingBalance: invoice.totalAmount,
      status: invoice.status,
    };
  }

  // Get current version
  const latestDoc = await GeneratedDocument.getLatest(
    "invoice",
    invoiceId,
    "pdf",
  );
  const newVersion = latestDoc ? latestDoc.version + 1 : 1;

  // Render HTML
  const html = renderInvoiceHtml({ invoice, contract, organization, computed });

  // Generate PDF
  const pdfBuffer = await htmlToPdf(html);

  // Upload to Cloudinary
  const fileName = `${invoice.invoiceNumber}-v${newVersion}.pdf`;
  const cloudinaryResult = await uploadToCloudinary(pdfBuffer, {
    folder: "invoices",
    publicId: `${invoice.invoiceNumber}-v${newVersion}`,
  });

  // Store GeneratedDocument record
  const generatedDoc = await GeneratedDocument.create({
    entityType: "invoice",
    entityId: invoiceId,
    entityModel: "InvoiceV3",
    documentNumber: invoice.invoiceNumber,
    version: newVersion,
    isLatest: true,
    format: "pdf",
    fileName,
    fileSize: pdfBuffer.length,
    mimeType: "application/pdf",
    cloudinaryId: cloudinaryResult.public_id,
    cloudinaryUrl: cloudinaryResult.url,
    secureUrl: cloudinaryResult.secure_url,
    generationReason: reason,
    generatedBy: userId,
  });

  // Update invoice with latest PDF URL
  await InvoiceV3.findByIdAndUpdate(invoiceId, {
    generatedPdfUrl: cloudinaryResult.secure_url,
    generatedHtmlUrl: null, // Could store HTML too if needed
  });

  return {
    generatedDocument: generatedDoc,
    pdfUrl: cloudinaryResult.secure_url,
    version: newVersion,
  };
}

/**
 * Generate and store receipt PDF
 */
export async function generateReceiptPdf(
  receiptId,
  userId,
  reason = "initial",
) {
  // Fetch receipt with related data
  const receipt = await ReceiptV3.findById(receiptId)
    .populate("invoice")
    .populate("createdBy", "name email")
    .lean();

  if (!receipt) {
    throw new Error("Receipt not found");
  }

  // Fetch invoice and contract
  const invoice = await InvoiceV3.findById(
    receipt.invoice._id || receipt.invoice,
  )
    .populate("contract")
    .lean();

  const contract = invoice?.contract
    ? await ContractV3.findById(invoice.contract._id || invoice.contract)
        .populate("parties.organizationId")
        .lean()
    : null;

  // Get organization
  let organization = null;
  if (contract?.parties?.[0]?.organizationId) {
    organization = contract.parties[0].organizationId;
  }

  // Get current version
  const latestDoc = await GeneratedDocument.getLatest(
    "receipt",
    receiptId,
    "pdf",
  );
  const newVersion = latestDoc ? latestDoc.version + 1 : 1;

  // Render HTML
  const html = renderReceiptHtml({ receipt, invoice, contract, organization });

  // Generate PDF
  const pdfBuffer = await htmlToPdf(html);

  // Upload to Cloudinary
  const fileName = `${receipt.receiptNumber}-v${newVersion}.pdf`;
  const cloudinaryResult = await uploadToCloudinary(pdfBuffer, {
    folder: "receipts",
    publicId: `${receipt.receiptNumber}-v${newVersion}`,
  });

  // Store GeneratedDocument record
  const generatedDoc = await GeneratedDocument.create({
    entityType: "receipt",
    entityId: receiptId,
    entityModel: "ReceiptV3",
    documentNumber: receipt.receiptNumber,
    version: newVersion,
    isLatest: true,
    format: "pdf",
    fileName,
    fileSize: pdfBuffer.length,
    mimeType: "application/pdf",
    cloudinaryId: cloudinaryResult.public_id,
    cloudinaryUrl: cloudinaryResult.url,
    secureUrl: cloudinaryResult.secure_url,
    generationReason: reason,
    generatedBy: userId,
  });

  // Update receipt with latest PDF URL
  await ReceiptV3.findByIdAndUpdate(
    receiptId,
    {
      generatedPdfUrl: cloudinaryResult.secure_url,
      generatedHtmlUrl: null,
    },
    { timestamps: false }, // Don't trigger the immutability check
  ).setOptions({ overwriteImmutable: true });

  return {
    generatedDocument: generatedDoc,
    pdfUrl: cloudinaryResult.secure_url,
    version: newVersion,
  };
}

/**
 * Get all generated documents for an entity
 */
export async function getGeneratedDocuments(entityType, entityId) {
  return GeneratedDocument.find({
    entityType,
    entityId,
    isDeleted: false,
  })
    .sort({ version: -1 })
    .populate("generatedBy", "name email");
}

/**
 * Get latest generated document for an entity
 */
export async function getLatestDocument(entityType, entityId, format = "pdf") {
  return GeneratedDocument.getLatest(entityType, entityId, format);
}
