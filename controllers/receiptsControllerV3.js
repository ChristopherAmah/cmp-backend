import ReceiptV3 from "../models/ReceiptV3.js";
import {
  createReceipt,
  createReversalReceipt,
  getReceiptsForInvoice,
  getReceipt,
} from "../services/receiptServiceV3.js";

// POST /api/v3/receipts
export const createReceiptController = async (req, res) => {
  try {
    const receipt = await createReceipt({
      invoiceId: req.body.invoiceId,
      payload: req.body,
      actorId: req.user.id,
    });

    const populated = await ReceiptV3.findById(receipt._id)
      .populate("invoice", "invoiceNumber totalAmount currency")
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error creating receipt:", error);
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

// GET /api/v3/receipts/invoice/:invoiceId
export const getReceiptsForInvoiceController = async (req, res) => {
  try {
    const receipts = await getReceiptsForInvoice(req.params.invoiceId);

    res.status(200).json({
      status: "success",
      data: receipts,
    });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET /api/v3/receipts/:id
export const getReceiptController = async (req, res) => {
  try {
    const receipt = await getReceipt(req.params.id);

    res.status(200).json({
      status: "success",
      data: receipt,
    });
  } catch (error) {
    console.error("Error fetching receipt:", error);
    if (error.message === "Receipt not found") {
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

// POST /api/v3/receipts/invoice/:invoiceId/with-proof
export const createReceiptWithProofController = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    // Build payload from form data
    const payload = {
      amount: parseFloat(req.body.amount),
      currency: req.body.currency,
      paymentMethod: req.body.paymentMethod,
      paymentDate: req.body.paymentDate,
      payer: req.body.payer || undefined,
      referenceNumber: req.body.referenceNumber || undefined,
      notes: req.body.notes || undefined,
    };

    // If file was uploaded, add proof info
    if (req.file) {
      payload.proofUrl = req.file.path || req.file.secure_url;
      payload.proofCloudinaryId = req.file.public_id || req.file.filename;
      payload.proofFileName = req.file.originalname;
    }

    const receipt = await createReceipt({
      invoiceId,
      payload,
      actorId: req.user.id,
    });

    const populated = await ReceiptV3.findById(receipt._id)
      .populate("invoice", "invoiceNumber totalAmount currency")
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error creating receipt with proof:", error);
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

// POST /api/v3/receipts/:id/reverse
export const reverseReceiptController = async (req, res) => {
  try {
    const reversalReceipt = await createReversalReceipt({
      receiptId: req.params.id,
      reason: req.body.reason,
      actorId: req.user.id,
    });

    const populated = await ReceiptV3.findById(reversalReceipt._id)
      .populate("invoice", "invoiceNumber totalAmount currency")
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error reversing receipt:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};
