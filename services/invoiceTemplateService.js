import Contract from "../models/ContractV3.js";
import Organization from "../models/Organization.js";

/**
 * Render invoice HTML template server-side
 */
export async function renderInvoiceHtml({ invoice, contract }) {
  // Populate organization if needed
  let organization = contract.organization;
  if (typeof organization === "object" && !organization.name) {
    organization = await Organization.findById(organization);
  }

  const formatCurrency = (amount, currency = "NGN") => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; 
          padding: 40px;
          color: #1a1a1a;
          background: #fff;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
        }
        .header-left h1 {
          font-size: 28px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        .header-left p {
          color: #6b7280;
          font-size: 14px;
        }
        .header-right {
          text-align: right;
        }
        .header-right p {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .line-items { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 24px;
          margin-bottom: 24px;
        }
        .line-items thead {
          background: #f9fafb;
        }
        .line-items th, .line-items td { 
          border: 1px solid #e5e7eb; 
          padding: 12px 16px; 
          font-size: 14px;
          text-align: left;
        }
        .line-items th {
          font-weight: 600;
          color: #374151;
        }
        .line-items td:last-child,
        .line-items th:last-child {
          text-align: right;
        }
        .line-items tbody tr:nth-child(even) {
          background: #f9fafb;
        }
        .totals { 
          margin-top: 24px; 
          float: right; 
          font-size: 16px;
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .totals-row.total {
          font-weight: 700;
          font-size: 18px;
          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
          padding-top: 12px;
          padding-bottom: 12px;
          margin-top: 8px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 8px;
        }
        .status-${invoice.status.toLowerCase()} {
          background: #dbeafe;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>Invoice ${invoice.invoiceNumber}</h1>
          <p>Contract: ${contract.name}</p>
          <p>Organization: ${
            organization?.name || contract.companyName || ""
          }</p>
        </div>
        <div class="header-right">
          <p><strong>Issue Date:</strong> ${formatDate(invoice.issueDate)}</p>
          <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
          <span class="status-badge status-${invoice.status.toLowerCase()}">${
    invoice.status
  }</span>
        </div>
      </div>
      <table class="line-items">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.lineItems
            .map(
              (li) => `
              <tr>
                <td>${li.description}</td>
                <td style="text-align:right;">${li.quantity}</td>
                <td style="text-align:right;">${formatCurrency(
                  li.unitPrice,
                  invoice.currency
                )}</td>
                <td style="text-align:right;">${formatCurrency(
                  li.total,
                  invoice.currency
                )}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
        </div>
        ${
          invoice.discount > 0
            ? `
        <div class="totals-row">
          <span>Discount:</span>
          <span>-${formatCurrency(invoice.discount, invoice.currency)}</span>
        </div>
        `
            : ""
        }
        ${
          invoice.taxRate > 0
            ? `
        <div class="totals-row">
          <span>Tax (${invoice.taxRate}%):</span>
          <span>${formatCurrency(invoice.taxAmount, invoice.currency)}</span>
        </div>
        `
            : ""
        }
        <div class="totals-row total">
          <span>Total:</span>
          <span>${formatCurrency(invoice.totalAmount, invoice.currency)}</span>
        </div>
      </div>
      ${
        invoice.notes
          ? `
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p><strong>Notes:</strong></p>
        <p style="color: #6b7280; margin-top: 8px;">${invoice.notes}</p>
      </div>
      `
          : ""
      }
    </body>
    </html>
  `;
}
