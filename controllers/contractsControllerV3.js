import ContractV3 from "../models/ContractV3.js";
import {
  buildContractQuery,
  calculateContractMetrics,
  getAllowedStatusTransitions,
  canTransitionStatus,
  logContractActivity,
  canEditContract,
  canDeleteContract,
  validateAndFilterUpdateData,
} from "../services/contractServiceV3.js";
import { logAction } from "../middleware/auditLog.js";

// GET /api/v3/contracts
export const getContracts = async (req, res) => {
  try {
    const {
      search,
      status,
      category,
      priority,
      organizationId,
      tags,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      isArchived = false,
    } = req.query;

    const query = buildContractQuery({
      search,
      status: status ? (Array.isArray(status) ? status : [status]) : undefined,
      category: category
        ? Array.isArray(category)
          ? category
          : [category]
        : undefined,
      priority: priority
        ? Array.isArray(priority)
          ? priority
          : [priority]
        : undefined,
      organizationId,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      isArchived: isArchived === "true",
    });

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query
    const [contracts, total] = await Promise.all([
      ContractV3.find(query)
        .populate("parties.organizationId", "name organizationType")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ContractV3.countDocuments(query),
    ]);

    // Add computed fields
    const contractsWithMeta = contracts.map((contract) => {
      const allowedTransitions = getAllowedStatusTransitions(contract.status);
      return {
        ...contract,
        allowedTransitions,
        canEdit: canEditContract(contract),
        canDelete: canDeleteContract(contract),
      };
    });

    res.status(200).json({
      status: "success",
      data: contractsWithMeta,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET /api/v3/contracts/metrics
export const getContractMetrics = async (req, res) => {
  try {
    const filters = req.query;
    const metrics = await calculateContractMetrics(filters);

    res.status(200).json({
      status: "success",
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching contract metrics:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// GET /api/v3/contracts/:id
export const getContract = async (req, res) => {
  try {
    const contract = await ContractV3.findById(req.params.id)
      .populate("parties.organizationId", "name organizationType description")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("approvedBy", "name email")
      .populate("signedBy.userId", "name email")
      .lean();

    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    const allowedTransitions = getAllowedStatusTransitions(contract.status);

    res.status(200).json({
      status: "success",
      data: {
        ...contract,
        allowedTransitions,
        canEdit: canEditContract(contract),
        canDelete: canDeleteContract(contract),
      },
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// POST /api/v3/contracts
export const createContract = async (req, res) => {
  try {
    const contractData = {
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    };

    // new contracts start as draft
    if (!contractData.status || contractData.status === "active") {
      contractData.status = "draft";
    }

    const contract = await ContractV3.create(contractData);

    await logContractActivity({
      contractId: contract._id,
      actorId: req.user.id,
      action: "CREATED",
      message: "Contract created",
    });

    await logAction({
      req,
      action: "CONTRACT_CREATED",
      resourceType: "Contract",
      resourceId: contract._id,
      resourceName: contract.title || contract.contractNumber,
      metadata: {
        status: contract.status,
        category: contract.category,
        organizationId: contract.organization,
      },
      severity: "medium",
    });

    const populated = await ContractV3.findById(contract._id)
      .populate("parties.organizationId", "name organizationType")
      .populate("createdBy", "name email")
      .lean();

    res.status(201).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error creating contract:", error);
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

// PATCH /api/v3/contracts/:id
export const updateContract = async (req, res) => {
  try {
    const contract = await ContractV3.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    if (!canEditContract(contract)) {
      return res.status(403).json({
        status: "error",
        message: `Cannot edit contract in ${contract.status} status`,
      });
    }

    // Don't allow status changes via update
    const { status, ...updateData } = req.body;
    if (status) {
      return res.status(400).json({
        status: "error",
        message: "Use PATCH /api/v3/contracts/:id/status to change status",
      });
    }

    // Validate and filter update data based on contract status
    const { filteredData, restrictedFields } = validateAndFilterUpdateData(
      contract,
      updateData
    );

    if (restrictedFields.length > 0) {
      return res.status(403).json({
        status: "error",
        message: `Cannot edit restricted fields in ${contract.status} status`,
        restrictedFields,
        allowedFields: contract.status === "pending_signature" 
          ? ["title", "description", "tags", "customFields", "priority", "compliance"]
          : "all fields",
      });
    }

    // Only update allowed fields
    Object.assign(contract, filteredData);
    contract.updatedBy = req.user.id;
    await contract.save();

    await logContractActivity({
      contractId: contract._id,
      actorId: req.user.id,
      action: "UPDATED",
      message: "Contract updated",
      metadata: { changes: updateData },
    });

    await logAction({
      req,
      action: "CONTRACT_UPDATED",
      resourceType: "Contract",
      resourceId: contract._id,
      resourceName: contract.title || contract.contractNumber,
      metadata: {
        changes: updateData,
      },
      severity: "medium",
    });

    const populated = await ContractV3.findById(contract._id)
      .populate("parties.organizationId", "name organizationType")
      .populate("updatedBy", "name email")
      .lean();

    res.status(200).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error updating contract:", error);
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

// PATCH /api/v3/contracts/:id/status
export const updateContractStatus = async (req, res) => {
  try {
    const { status: newStatus, note } = req.body;

    if (!newStatus) {
      return res.status(400).json({
        status: "error",
        message: "Status is required",
      });
    }

    const contract = await ContractV3.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    if (!canTransitionStatus(contract.status, newStatus)) {
      return res.status(400).json({
        status: "error",
        message: `Cannot transition from ${contract.status} to ${newStatus}`,
        allowedTransitions: getAllowedStatusTransitions(contract.status),
      });
    }

    const oldStatus = contract.status;
    contract.status = newStatus;
    contract.updatedBy = req.user.id;

    // Handle status-specific updates
    if (newStatus === "active" && !contract.timeline.signedDate) {
      contract.timeline.signedDate = new Date();
    }
    if (newStatus === "terminated" && !contract.timeline.terminationDate) {
      contract.timeline.terminationDate = new Date();
    }

    await contract.save();

    await logContractActivity({
      contractId: contract._id,
      actorId: req.user.id,
      action: "STATUS_CHANGE",
      message: note || `Status changed from ${oldStatus} to ${newStatus}`,
      metadata: { fromStatus: oldStatus, toStatus: newStatus },
    });

    const populated = await ContractV3.findById(contract._id)
      .populate("parties.organizationId", "name organizationType")
      .lean();

    res.status(200).json({
      status: "success",
      data: populated,
    });
  } catch (error) {
    console.error("Error updating contract status:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// DELETE /api/v3/contracts/:id (soft delete - archives it)
export const deleteContract = async (req, res) => {
  try {
    const contract = await ContractV3.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        status: "error",
        message: "Contract not found",
      });
    }

    if (!canDeleteContract(contract)) {
      return res.status(403).json({
        status: "error",
        message: `Cannot delete contract in ${contract.status} status`,
      });
    }

    // Soft delete
    contract.isArchived = true;
    contract.archivedAt = new Date();
    contract.archivedBy = req.user.id;
    await contract.save();

    await logContractActivity({
      contractId: contract._id,
      actorId: req.user.id,
      action: "ARCHIVED",
      message: "Contract archived",
    });

    res.status(200).json({
      status: "success",
      message: "Contract archived successfully",
    });
  } catch (error) {
    console.error("Error archiving contract:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};