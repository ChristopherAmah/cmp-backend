/**
 * Receipt Template Service
 * Generates receipt HTML templates for auto-generated receipts
 */

import ContractV3 from "../models/ContractV3.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import Organization from "../models/Organization.js";

/**
 * Render receipt HTML template
 */
export async function renderReceiptHtml({ receipt, invoice, contract }) {
  // Get contract parties for payer info
  const payerInfo = receipt.payer || 
    contract.parties?.find(p => p.role === "client")?.organizationId?.name ||
    contract.parties?.[0]?.organizationId?.name ||
    "N/A";

  // Get organization details
  let organization;
  if (contract.parties && contract.parties.length > 0) {
    const orgId = contract.parties[0]?.organizationId;
    if (orgId) {
      organization = await Organization.findById(
        typeof orgId === "object" ? orgId._id : orgId
      );
    }
  }

  const formatCurrency = (amount, currency = "USD") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate remaining balance (for display)
  const paidAmount = receipt.amount;
  const totalAmount = invoice.totalAmount;
  const remainingBalance = Math.max(0, totalAmount - paidAmount);

  const paymentMethodLabels = {
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    card: "Card",
    cheque: "Cheque",
    wire_transfer: "Wire Transfer",
    ach: "ACH",
    other: "Other",
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt ${receipt.receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; 
          padding: 40px;
          color: #1a1a1a;
          background: #fff;
          line-height: 1.6;
        }
        .receipt-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 2px solid #00B4D8;
        }
        .header h1 {
          font-size: 36px;
          font-weight: 700;
          color: #00B4D8;
          margin-bottom: 8px;
        }
        .header .receipt-number {
          font-size: 18px;
          color: #6b7280;
          font-weight: 600;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 40px;
        }
        .info-section {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
        }
        .info-section h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .info-section p {
          font-size: 16px;
          color: #1a1a1a;
          margin: 8px 0;
          font-weight: 500;
        }
        .payment-details {
          background: linear-gradient(135deg, #00B4D8 0%, #0091B3 100%);
          color: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 40px;
        }
        .payment-details h2 {
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: 700;
        }
        .payment-amount {
          font-size: 48px;
          font-weight: 800;
          margin: 20px 0;
          text-align: center;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        .detail-item {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 8px;
        }
        .detail-item label {
          display: block;
          font-size: 12px;
          opacity: 0.9;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-item .value {
          font-size: 18px;
          font-weight: 600;
        }
        .invoice-summary {
          background: #f9fafb;
          padding: 25px;
          border-radius: 8px;
          margin-bottom: 40px;
        }
        .invoice-summary h3 {
          font-size: 16px;
          margin-bottom: 15px;
          color: #374151;
          font-weight: 600;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .summary-row:last-child {
          border-bottom: none;
          font-weight: 700;
          font-size: 18px;
          margin-top: 10px;
          padding-top: 15px;
          border-top: 2px solid #00B4D8;
        }
        .footer {
          text-align: center;
          padding-top: 30px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        @media print {
          body { padding: 0; }
          .receipt-container { box-shadow: none; border: none; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <h1>PAYMENT RECEIPT</h1>
          <div class="receipt-number">Receipt #${receipt.receiptNumber}</div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>Invoice Information</h3>
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Contract:</strong> ${contract.title}</p>
            <p><strong>Issue Date:</strong> ${formatDate(invoice.issueDate)}</p>
          </div>
          <div class="info-section">
            <h3>Payment Information</h3>
            <p><strong>Payment Date:</strong> ${formatDate(receipt.paymentDate)}</p>
            <p><strong>Payment Method:</strong> ${paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod}</p>
            ${receipt.referenceNumber ? `<p><strong>Reference:</strong> ${receipt.referenceNumber}</p>` : ""}
          </div>
        </div>

        <div class="payment-details">
          <h2>Amount Received</h2>
          <div class="payment-amount">${formatCurrency(receipt.amount, receipt.currency)}</div>
          <div class="details-grid">
            <div class="detail-item">
              <label>Payer</label>
              <div class="value">${payerInfo}</div>
            </div>
            <div class="detail-item">
              <label>Currency</label>
              <div class="value">${receipt.currency}</div>
            </div>
          </div>
        </div>

        <div class="invoice-summary">
          <h3>Invoice Summary</h3>
          <div class="summary-row">
            <span>Total Invoice Amount:</span>
            <span>${formatCurrency(totalAmount, invoice.currency)}</span>
          </div>
          <div class="summary-row">
            <span>Amount Paid (this receipt):</span>
            <span>${formatCurrency(paidAmount, receipt.currency)}</span>
          </div>
          <div class="summary-row">
            <span>Remaining Balance:</span>
            <span>${formatCurrency(remainingBalance, invoice.currency)}</span>
          </div>
        </div>

        ${receipt.notes ? `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
          <h3 style="font-size: 14px; margin-bottom: 8px; color: #92400e;">Notes</h3>
          <p style="color: #78350f;">${receipt.notes}</p>
        </div>
        ` : ""}

        <div class="footer">
          <p><strong>FifthLab</strong> - Contract Management Platform</p>
          <p>This is an official payment receipt</p>
          <p style="margin-top: 10px; font-size: 12px;">Generated on ${formatDate(new Date())}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
