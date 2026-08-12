import ContractDocument from "../models/ContractDocument.js";
import Contract from "../models/ContractV3.js";
import ContractActivityLog from "../models/ContractActivityLog.js";
import cloudinary from "../config/cloudinary.js";

const logActivity = async ({ contractId, action, actor, message, metadata }) => {
  try {
    await ContractActivityLog.create({
      contract: contractId,
      action,
      actor,
      message,
      metadata,
    });
  } catch (e) {
    // swallow
  }
};

export const getContractDocuments = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { documentType } = req.query;

    const query = { contract: contractId };
    if (documentType) {
      query.documentType = documentType;
    }

    const documents = await ContractDocument.find(query)
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      status: "success",
      data: documents,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const uploadContractDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Please upload a file",
      });
    }

    const contractId = req.params.id;
    const { documentName, documentType } = req.body;

    // Verify contract exists
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    const document = await ContractDocument.create({
      contract: contractId,
      documentName: documentName || req.file.originalname,
      documentType: documentType || "Other",
      cloudinaryId: req.file.public_id || req.file.filename,
      cloudinaryUrl: req.file.secure_url || req.file.path,
      originalFileName: req.file.originalname,
      fileSize: req.file.size || req.file.bytes,
      uploadedBy: req.user.id,
    });

    await logActivity({
      contractId,
      action: "DOCUMENT_UPLOADED",
      actor: req.user.id,
      message: "Document uploaded",
      metadata: { documentId: document._id, documentName: document.documentName },
    });

    const populated = await ContractDocument.findById(document._id)
      .populate("uploadedBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const downloadContractDocument = async (req, res) => {
  try {
    const document = await ContractDocument.findById(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    // Verify contract access
    const contract = await Contract.findById(document.contract);
    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    if (document.cloudinaryUrl) {
      res.redirect(document.cloudinaryUrl);
    } else {
      res.status(404).json({
        status: "error",
        message: "Document URL not available",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteContractDocument = async (req, res) => {
  try {
    const document = await ContractDocument.findById(req.params.documentId);

    if (!document) {
      return res.status(404).json({
        status: "error",
        message: "Document not found",
      });
    }

    const contractId = document.contract;

    // Delete from Cloudinary if cloudinaryId exists
    if (document.cloudinaryId) {
      try {
        await cloudinary.v2.uploader.destroy(document.cloudinaryId);
      } catch (cloudinaryError) {
        console.error("Error deleting from Cloudinary:", cloudinaryError);
        // Continue with document deletion even if Cloudinary deletion fails
      }
    }

    await ContractDocument.findByIdAndDelete(req.params.documentId);

    await logActivity({
      contractId,
      action: "DOCUMENT_DELETED",
      actor: req.user.id,
      message: "Document deleted",
      metadata: { documentName: document.documentName },
    });

    res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
