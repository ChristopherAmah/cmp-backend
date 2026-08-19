/**
 * Modern Contract Service - V3
 * Business logic and utilities for contract management
 */

import ContractV3 from "../models/ContractV3.js";
import ContractActivityLog from "../models/ContractActivityLog.js";

/**
 * Status transition validation
 */
const ALLOWED_STATUS_TRANSITIONS = {
  draft: ["pending_signature", "cancelled"],
  pending_signature: ["active", "draft", "cancelled"],
  active: ["expired", "terminated", "renewed"],
  expired: ["renewed", "terminated"],
  terminated: [],
  renewed: ["active"],
  cancelled: [],
};

export function getAllowedStatusTransitions(currentStatus) {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
}

export function canTransitionStatus(currentStatus, newStatus) {
  const allowed = getAllowedStatusTransitions(currentStatus);
  return allowed.includes(newStatus);
}

/**
 * Contract lifecycle helpers based on actual expiration dates
 */
export function getContractExpirationDate(contract) {
  const expirationDate = contract?.timeline?.expirationDate;
  if (!expirationDate) return null;

  const parsedDate = new Date(expirationDate);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function isContractExpired(contract, now = new Date()) {
  const expirationDate = getContractExpirationDate(contract);
  if (!expirationDate) return false;

  return expirationDate < now || contract?.status === "expired";
}

export function isContractExpiringSoon(
  contract,
  now = new Date(),
  daysAhead = 30
) {
  const expirationDate = getContractExpirationDate(contract);
  if (!expirationDate) return false;

  const msUntilExpiration = expirationDate.getTime() - now.getTime();
  const warningWindowMs = daysAhead * 24 * 60 * 60 * 1000;

  return msUntilExpiration > 0 && msUntilExpiration <= warningWindowMs;
}

/**
 * Build query filters for contracts
 */
export function buildContractQuery(filters = {}) {
  const {
    search,
    status,
    category,
    priority,
    organizationId,
    dateRange,
    tags,
    isArchived = false,
  } = filters;

  const query = { isArchived };

  // Search across multiple fields
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { contractNumber: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status) {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }

  // Category filter
  if (category) {
    if (Array.isArray(category)) {
      query.category = { $in: category };
    } else {
      query.category = category;
    }
  }

  // Priority filter
  if (priority) {
    if (Array.isArray(priority)) {
      query.priority = { $in: priority };
    } else {
      query.priority = priority;
    }
  }

  // Organization filter
  if (organizationId) {
    query["parties.organizationId"] = organizationId;
  }

  // Date range filter
  if (dateRange) {
    if (dateRange.startDate || dateRange.endDate) {
      query["timeline.effectiveDate"] = {};
      if (dateRange.startDate) {
        query["timeline.effectiveDate"].$gte = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        query["timeline.effectiveDate"].$lte = new Date(dateRange.endDate);
      }
    }
  }

  // Tags filter
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  return query;
}

/**
 * Calculate contract metrics
 */
export async function calculateContractMetrics(filters = {}) {
  const query = buildContractQuery(filters);
  const now = new Date();

  const [
    total,
    byStatus,
    byCategory,
    byPriority,
    recentlySigned,
    matchingContracts,
  ] = await Promise.all([
    ContractV3.countDocuments(query),
    ContractV3.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ContractV3.aggregate([
      { $match: query },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    ContractV3.aggregate([
      { $match: query },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    ContractV3.countDocuments({
      ...query,
      "timeline.signedDate": {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    }),
    ContractV3.find(query)
      .select("status timeline.expirationDate")
      .lean(),
  ]);

  const statusSummary = byStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const expiredContracts = matchingContracts.filter((contract) =>
    isContractExpired(contract, now)
  ).length;

  const expiringSoon = matchingContracts.filter((contract) =>
    isContractExpiringSoon(contract, now, 30)
  ).length;

  statusSummary.expired = expiredContracts;

  return {
    total,
    byStatus: statusSummary,
    byCategory: byCategory.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byPriority: byPriority.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    expiringSoon,
    recentlySigned,
  };
}

/**
 * Log contract activity
 */
export async function logContractActivity({
  contractId,
  actorId,
  action,
  message,
  metadata = {},
}) {
  return await ContractActivityLog.create({
    contract: contractId,
    actor: actorId,
    action,
    message,
    metadata,
  });
}

/**
 * Check if contract can be edited
 */
export function canEditContract(contract) {
  const editableStatuses = ["draft", "pending_signature"];
  return editableStatuses.includes(contract.status);
}

/**
 * Get editable fields for a contract status
 * Returns null if all fields are editable, or array of editable field names
 */
export function getEditableFieldsForStatus(status) {
  if (status === "draft") {
    return null; // All fields editable
  }
  if (status === "pending_signature") {
    // Only metadata fields editable when pending signature
    return [
      "title",
      "description",
      "tags",
      "customFields",
      "priority",
      "compliance",
    ];
  }
  return []; // No fields editable
}

/**
 * Check if a specific field can be edited for a contract
 */
export function canEditField(contract, fieldName) {
  if (!canEditContract(contract)) {
    return false;
  }
  
  const editableFields = getEditableFieldsForStatus(contract.status);
  if (editableFields === null) {
    return true; // All fields editable
  }
  
  // Handle nested fields (e.g., "pricing.baseAmount" should check "pricing")
  const topLevelField = fieldName.split(".")[0];
  return editableFields.includes(topLevelField);
}

/**
 * Validate and filter update data based on contract status
 * Returns filtered data and any restricted fields
 */
export function validateAndFilterUpdateData(contract, updateData) {
  const editableFields = getEditableFieldsForStatus(contract.status);
  
  if (editableFields === null) {
    // All fields editable
    return { filteredData: updateData, restrictedFields: [] };
  }
  
  const filteredData = {};
  const restrictedFields = [];
  
  // Check each field in updateData
  for (const [fieldName, value] of Object.entries(updateData)) {
    const topLevelField = fieldName.split(".")[0];
    
    if (editableFields.includes(topLevelField)) {
      filteredData[fieldName] = value;
    } else {
      restrictedFields.push(fieldName);
    }
  }
  
  return { filteredData, restrictedFields };
}

/**
 * Check if contract can be deleted
 */
export function canDeleteContract(contract) {
  const deletableStatuses = ["draft", "cancelled"];
  return deletableStatuses.includes(contract.status);
}