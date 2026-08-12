import Organization from "../models/Organization.js";
import Contract from "../models/ContractV3.js";
import Document from "../models/Document.js";
import ContractDocument from "../models/ContractDocument.js";
import cloudinary from "../config/cloudinary.js";
import { logAction } from "../middleware/auditLog.js";

export const getOrganizations = async (req, res) => {
  try {
    const { search, page, limit } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { organizationType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page || 1));
    const limitNum = Math.min(500, Math.max(0, Number(limit || 0))); // 0 => no limit

    const findQuery = Organization.find(query)
      .select("name organizationType description createdAt")
      .sort({ createdAt: -1 });

    if (limitNum > 0) {
      findQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const [organizations, total] = await Promise.all([
      findQuery.lean(),
      limitNum > 0
        ? Organization.countDocuments(query)
        : Promise.resolve(undefined),
    ]);
    res.status(200).json({
      status: "success",
      data: organizations,
      meta:
        typeof total === "number"
          ? { page: pageNum, limit: limitNum, total }
          : undefined,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id).lean();
    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }
    res.status(200).json({
      status: "success",
      data: organization,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const createOrganization = async (req, res) => {
  try {
    const { name, organizationType, description } = req.body;

    const organization = await Organization.create({
      name,
      organizationType,
      description,
      createdBy: req.user.id,
    });

    // Log audit action
    await logAction({
      req,
      action: "ORGANIZATION_CREATED",
      resourceType: "Organization",
      resourceId: organization._id,
      resourceName: organization.name,
      metadata: {
        organizationType: organization.organizationType,
      },
      severity: "medium",
    });

    res.status(201).json({
      status: "success",
      data: organization,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }

    // Log audit action
    await logAction({
      req,
      action: "ORGANIZATION_UPDATED",
      resourceType: "Organization",
      resourceId: organization._id,
      resourceName: organization.name,
      metadata: {
        changes: req.body,
      },
      severity: "medium",
    });

    res.status(200).json({
      status: "success",
      data: organization,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const deleteOrganization = async (req, res) => {
  try {
    const organizationId = req.params.id;

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        status: "error",
        message: "Organization not found",
      });
    }

    // Find all contracts associated with this organization
    const contracts = await Contract.find({ organization: organizationId }).select("_id");
    const contractIds = contracts.map(c => c._id);

    // Find all contract documents associated with these contracts
    const contractDocuments = await ContractDocument.find({ 
      contract: { $in: contractIds } 
    });

    // Delete contract documents from Cloudinary and database
    for (const doc of contractDocuments) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinaryId, {
          resource_type: "raw",
        });
      } catch (cloudinaryError) {
        console.error(`Error deleting contract document from Cloudinary: ${doc.cloudinaryId}`, cloudinaryError);
      }
    }
    await ContractDocument.deleteMany({ contract: { $in: contractIds } });

    // Find all documents associated with this organization
    const documents = await Document.find({ organization: organizationId });

    // Delete documents from Cloudinary and database
    for (const doc of documents) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinaryId, {
          resource_type: "raw",
        });
      } catch (cloudinaryError) {
        console.error(`Error deleting document from Cloudinary: ${doc.cloudinaryId}`, cloudinaryError);
      }
    }
    await Document.deleteMany({ organization: organizationId });

    // Delete all contracts associated with this organization
    await Contract.deleteMany({ organization: organizationId });

    // Finally, delete the organization itself
    await Organization.findByIdAndDelete(organizationId);

    // Log audit action
    await logAction({
      req,
      action: "ORGANIZATION_DELETED",
      resourceType: "Organization",
      resourceId: organizationId,
      resourceName: organization.name,
      metadata: {
        deletedContracts: contractIds.length,
        deletedDocuments: documents.length,
      },
      severity: "high",
    });

    res.status(200).json({
      status: "success",
      message: "Organization and all associated contracts and documents deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

