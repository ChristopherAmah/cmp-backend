import InvoiceV3 from "../models/InvoiceV3.js";
import ReceiptV3 from "../models/ReceiptV3.js";
import {
  getInvoiceLedger,
  createInvoice,
  updateInvoice,
  issueInvoice,
  voidInvoice,
  getInvoiceWithLedger,
} from "../services/invoiceServiceV3.js";
import { createReceipt } from "../services/receiptServiceV3.js";
import { buildContractQuery } from "../services/contractServiceV3.js";
import { logAction } from "../middleware/auditLog.js";

// GET /api/v3/invoices
export const getInvoices = async (req, res) => {
  try {
    const {
      contractId,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};
    if (contractId) query.contract = contractId;
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [invoices, total] = await Promise.all([
      InvoiceV3.find(query)
        .populate("contract", "title contractNumber")
        .populate("createdBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InvoiceV3.countDocuments(query),
    ]);

    // Get ledgers for all invoices (with computed balances)
    const invoicesWithLedger = await Promise.all(
      invoices.map(async (invoice) => {
        try {
          const ledger = await getInvoiceLedger(invoice._id.toString());
          return {
            ...invoice,
            computed: ledger.computed,
          };
        } catch (err) {
          return {
            ...invoice,
            computed: {
              totalPaid: 0,
              remainingBalance: invoice.totalAmount,
              status: invoice.status,
            },
          };
        }
      })
    );

    res.status(200).json({
      status: "success",
      data: invoicesWithLedger,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * GET /api/v3/invoices/:id
 * Get single invoice with ledger
 */
export const getInvoice = async (req, res) => {
  try {
    const ledger = await getInvoiceWithLedger(req.params.id);

    res.status(200).json({
      status: "success",
      data: ledger,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    if (error.message === "Invoice not found") {
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/v3/invoices
export const createInvoiceController = async (req, res) => {
  try {
    const invoice = await createInvoice({
      contractId: req.body.contractId,
      payload: req.body,
      actorId: req.user.id,
    });

    const populated = await InvoiceV3.findById(invoice._id)
      .populate("contract", "title contractNumber")
      .populate("createdBy", "name email")
      .lean();

    // Log audit action
    await logAction({
      req,
      action: "INVOICE_CREATED",
      resourceType: "Invoice",
      resourceId: invoice._id,
      resourceName: populated.invoiceNumber || `Invoice for ${populated.contract?.title}`,
      metadata: {
        contractId: req.body.contractId,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
      severity: "medium",
    });

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: error.errors,
      });
    }
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// PUT /api/v3/invoices/:id (only draft invoices)
export const updateInvoiceController = async (req, res) => {
  try {
    const invoice = await updateInvoice({
      invoiceId: req.params.id,
      payload: req.body,
      actorId: req.user.id,
    });

    const populated = await InvoiceV3.findById(invoice._id)
      .populate("contract", "title contractNumber")
      .populate("updatedBy", "name email")
      .lean();

    // Log audit action
    await logAction({
      req,
      action: "INVOICE_UPDATED",
      resourceType: "Invoice",
      resourceId: invoice._id,
      resourceName: populated.invoiceNumber || `Invoice ${invoice._id}`,
      metadata: {
        changes: req.body,
      },
      severity: "medium",
    });

    res.status(200).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "error",
        message: error.message,
        errors: error.errors,
      });
    }
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/v3/invoices/:id/issue
export const issueInvoiceController = async (req, res) => {
  try {
    const invoice = await issueInvoice({
      invoiceId: req.params.id,
      actorId: req.user.id,
    });

    const populated = await InvoiceV3.findById(invoice._id)
      .populate("contract", "title contractNumber")
      .lean();

    // Log audit action
    await logAction({
      req,
      action: "INVOICE_ISSUED",
      resourceType: "Invoice",
      resourceId: invoice._id,
      resourceName: populated.invoiceNumber || `Invoice ${invoice._id}`,
      metadata: {
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
      severity: "high",
    });

    res.status(200).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error issuing invoice:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/v3/invoices/:id/void
export const voidInvoiceController = async (req, res) => {
  try {
    const invoice = await voidInvoice({
      invoiceId: req.params.id,
      reason: req.body.reason,
      actorId: req.user.id,
    });

    const populated = await InvoiceV3.findById(invoice._id)
      .populate("contract", "title contractNumber")
      .lean();

    // Log audit action
    await logAction({
      req,
      action: "INVOICE_VOIDED",
      resourceType: "Invoice",
      resourceId: invoice._id,
      resourceName: populated.invoiceNumber || `Invoice ${invoice._id}`,
      metadata: {
        reason: req.body.reason,
        totalAmount: invoice.totalAmount,
      },
      severity: "high",
    });

    res.status(200).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error voiding invoice:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

/**
 * POST /api/v3/invoices/:id/pay
 * Record payment (auto-generates receipt)
 * This is the main workflow: Record Payment → Auto-generate Receipt → Update Invoice Status
 */
export const recordPaymentController = async (req, res) => {
  try {
    const receipt = await createReceipt({
      invoiceId: req.params.id,
      payload: {
        amount: req.body.amount,
        currency: req.body.currency,
        paymentDate: req.body.paymentDate,
        paymentMethod: req.body.paymentMethod,
        payer: req.body.payer,
        referenceNumber: req.body.referenceNumber,
        notes: req.body.notes,
      },
      actorId: req.user.id,
    });

    // Get updated invoice with ledger
    const ledger = await getInvoiceLedger(req.params.id);

    const populatedReceipt = await ReceiptV3.findById(receipt._id)
      .populate("invoice", "invoiceNumber totalAmount currency")
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: {
        receipt: populatedReceipt,
        invoice: ledger.invoice,
        computed: ledger.computed,
      },
    });
  } catch (error) {
    console.error("Error recording payment:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};
