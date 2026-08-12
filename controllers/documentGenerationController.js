import {
  generateInvoicePdf,
  generateReceiptPdf,
  getGeneratedDocuments,
  getLatestDocument,
  renderInvoiceHtml,
  renderReceiptHtml,
} from "../services/documentGenerationService.js";
import GeneratedDocument from "../models/GeneratedDocument.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import ReceiptV3 from "../models/ReceiptV3.js";
import ContractV3 from "../models/ContractV3.js";
import { getInvoiceLedger } from "../services/invoiceServiceV3.js";

// POST /api/v3/documents/invoices/:id/generate
export const generateInvoiceDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "initial" } = req.body;
    
    const result = await generateInvoicePdf(id, req.user.id, reason);
    
    res.status(200).json({
      status: "success",
      message: "Invoice PDF generated successfully",
      data: {
        pdfUrl: result.pdfUrl,
        version: result.version,
        generatedDocument: result.generatedDocument,
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate invoice PDF",
    });
  }
};

// GET /api/v3/documents/invoices/:id/html
export const getInvoiceHtml = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await InvoiceV3.findById(id)
      .populate("contract")
      .lean();
    
    if (!invoice) {
      return res.status(404).json({
        status: "error",
        message: "Invoice not found",
      });
    }
    
    const contract = await ContractV3.findById(invoice.contract._id || invoice.contract)
      .populate("parties.organizationId")
      .lean();
    
    let organization = null;
    if (contract?.parties?.[0]?.organizationId) {
      organization = contract.parties[0].organizationId;
    }
    
    let computed = {};
    try {
      const ledger = await getInvoiceLedger(id);
      computed = ledger.computed;
    } catch (e) {
      computed = {
        totalPaid: 0,
        remainingBalance: invoice.totalAmount,
        status: invoice.status,
      };
    }
    
    const html = renderInvoiceHtml({ invoice, contract, organization, computed });
    
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error rendering invoice HTML:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to render invoice HTML",
    });
  }
};

/**
 * Get all generated documents for an invoice
 * GET /api/v3/documents/invoices/:id/versions
 */
export const getInvoiceDocumentVersions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const documents = await getGeneratedDocuments("invoice", id);
    
    res.status(200).json({
      status: "success",
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching invoice document versions:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch document versions",
    });
  }
};

/**
 * Get latest generated document for an invoice
 * GET /api/v3/documents/invoices/:id/latest
 */
export const getLatestInvoiceDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = "pdf" } = req.query;
    
    const document = await getLatestDocument("invoice", id, format);
    
    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "No generated document found for this invoice",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: document,
    });
  } catch (error) {
    console.error("Error fetching latest invoice document:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch latest document",
    });
  }
};

// ============================================================================
// RECEIPT DOCUMENT ENDPOINTS
// ============================================================================

/**
 * Generate PDF for a receipt
 * POST /api/v3/documents/receipts/:id/generate
 */
export const generateReceiptDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "initial" } = req.body;
    
    const result = await generateReceiptPdf(id, req.user.id, reason);
    
    res.status(200).json({
      status: "success",
      message: "Receipt PDF generated successfully",
      data: {
        pdfUrl: result.pdfUrl,
        version: result.version,
        generatedDocument: result.generatedDocument,
      },
    });
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to generate receipt PDF",
    });
  }
};

/**
 * Get receipt as HTML (for preview)
 * GET /api/v3/documents/receipts/:id/html
 */
export const getReceiptHtml = async (req, res) => {
  try {
    const { id } = req.params;
    
    const receipt = await ReceiptV3.findById(id)
      .populate("invoice")
      .lean();
    
    if (!receipt) {
      return res.status(404).json({
        status: "error",
        message: "Receipt not found",
      });
    }
    
    const invoice = await InvoiceV3.findById(receipt.invoice._id || receipt.invoice)
      .populate("contract")
      .lean();
    
    const contract = invoice?.contract
      ? await ContractV3.findById(invoice.contract._id || invoice.contract)
          .populate("parties.organizationId")
          .lean()
      : null;
    
    let organization = null;
    if (contract?.parties?.[0]?.organizationId) {
      organization = contract.parties[0].organizationId;
    }
    
    const html = renderReceiptHtml({ receipt, invoice, contract, organization });
    
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error rendering receipt HTML:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to render receipt HTML",
    });
  }
};

/**
 * Get all generated documents for a receipt
 * GET /api/v3/documents/receipts/:id/versions
 */
export const getReceiptDocumentVersions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const documents = await getGeneratedDocuments("receipt", id);
    
    res.status(200).json({
      status: "success",
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching receipt document versions:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch document versions",
    });
  }
};

/**
 * Get latest generated document for a receipt
 * GET /api/v3/documents/receipts/:id/latest
 */
export const getLatestReceiptDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = "pdf" } = req.query;
    
    const document = await getLatestDocument("receipt", id, format);
    
    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "No generated document found for this receipt",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: document,
    });
  } catch (error) {
    console.error("Error fetching latest receipt document:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch latest document",
    });
  }
};

// ============================================================================
// GENERAL DOCUMENT ENDPOINTS
// ============================================================================

/**
 * Get a generated document by ID
 * GET /api/v3/documents/:id
 */
export const getGeneratedDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await GeneratedDocument.findById(id)
      .populate("generatedBy", "name email");
    
    if (!document || document.isDeleted) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }
    
    res.status(200).json({
      status: "success",
      data: document,
    });
  } catch (error) {
    console.error("Error fetching generated document:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch document",
    });
  }
};
