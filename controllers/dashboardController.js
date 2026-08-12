import Document from "../models/Document.js";
import Organization from "../models/Organization.js";
import ContractActivityLog from "../models/ContractActivityLog.js";
import Contract from "../models/ContractV3.js";
import AuditLog from "../models/AuditLog.js";
import InvoiceV3 from "../models/InvoiceV3.js";
import Ticket from "../models/Ticket.js";

export const getDashboardStats = async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const activeContractQuery = { status: "active", isArchived: false };
    const activeLicenseContractQuery = {
      ...activeContractQuery,
      category: "license",
    };
    const activeAtsContractQuery = {
      ...activeContractQuery,
      category: "support",
    };
    const atsRenewalsDueQuery = {
      ...activeAtsContractQuery,
      "timeline.expirationDate": {
        $gte: now,
        $lte: thirtyDaysFromNow,
      },
    };

    const [
      totalOrganizations,
      totalDocuments,
      recentDocuments,
      expiredDocuments,
      expiringSoonDocuments,
      activeContracts,
      activeLicenseContracts,
      activeAtsContracts,
      atsRenewalsDue,
      openTickets,
      ticketsBreachingSla,
      documentDistribution,
      recentUploadsCount,
      expiringSoonList,
      expiredList,
    ] = await Promise.all([
      // Organizations
      Organization.countDocuments(),
      // Documents
      Document.countDocuments(),
      Document.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("organization", "name")
        .populate("uploadedBy", "name email profilePicture")
        .select("documentName documentType createdAt organization uploadedBy")
        .lean(),
      Document.countDocuments({ expiryDate: { $lt: new Date() } }),
      Document.countDocuments({
        expiryDate: {
          $gt: new Date(),
          $lt: thirtyDaysFromNow,
        },
      }),
      // Active contracts
      Contract.countDocuments(activeContractQuery),
      // Active license contracts
      Contract.countDocuments(activeLicenseContractQuery),
      // Active ATS contracts
      Contract.countDocuments(activeAtsContractQuery),
      // ATS renewals due in the next 30 days
      Contract.countDocuments(atsRenewalsDueQuery),
      // Open support tickets
      Ticket.countDocuments({ status: "Open" }),
      // Tickets with breached SLA state
      Ticket.countDocuments({ "sla.state": "breached" }),
      // Document distribution
      Document.aggregate([
        { $group: { _id: "$documentType", count: { $sum: 1 } } },
      ]),
      Document.countDocuments({
        createdAt: { $gt: sevenDaysAgo },
      }),
      // Expiring soon documents
      Document.find({ expiryDate: { $gte: now, $lte: thirtyDaysFromNow } })
        .sort({ expiryDate: 1 })
        .limit(5)
        .populate("organization", "name")
        .select("documentName documentType expiryDate organization")
        .lean(),
      // Expired documents list
      Document.find({ expiryDate: { $lt: now } })
        .sort({ expiryDate: -1 })
        .limit(5)
        .populate("organization", "name")
        .select("documentName documentType expiryDate organization")
        .lean(),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        totalOrganizations,
        totalDocuments,
        recentUploads: recentUploadsCount,
        expired: expiredDocuments,
        expiringSoon: expiringSoonDocuments,
        activeContracts,
        activeLicenseContracts,
        activeAtsContracts,
        atsRenewalsDue,
        openTickets,
        ticketsBreachingSla,
        documentDistribution,
        recentDocuments, // Sending the actual 5 recent docs, not just count
        expiringSoonList,
        expiredList,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch dashboard statistics",
    });
  }
};

export const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = [];

    // Get recent audit logs (tracks all user actions)
    const auditLogs = await AuditLog.find({
      status: "success", // Only show successful actions
    })
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Get more to filter and format
      .lean();

    // Format audit logs into activity items
    for (const log of auditLogs) {
      const activity = {
        _id: log._id,
        type: "audit",
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        actor: {
          _id: log.userId,
          name: log.userName,
          email: log.userEmail,
          role: log.userRole,
        },
        createdAt: log.createdAt,
        metadata: log.metadata,
      };

      // Only include relevant actions for activity feed
      const relevantActions = [
        "CONTRACT_CREATED",
        "CONTRACT_UPDATED",
        "CONTRACT_DELETED",
        "INVOICE_CREATED",
        "INVOICE_ISSUED",
        "INVOICE_UPDATED",
        "PAYMENT_RECORDED",
        "ORGANIZATION_CREATED",
        "ORGANIZATION_UPDATED",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_DELETED",
        "USER_CREATED",
        "USER_UPDATED",
      ];

      if (relevantActions.includes(log.action)) {
        activities.push(activity);
      }
    }

    // Get contract activity logs for more detailed contract activities
    const contractActivities = await ContractActivityLog.find()
      .populate("actor", "name email role profilePicture")
      .populate({
        path: "contract",
        select: "title name companyName contractType organization",
        populate: {
          path: "organization",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Format contract activity logs
    for (const activity of contractActivities) {
      activities.push({
        _id: activity._id,
        type: "contract_activity",
        action: activity.action,
        resourceType: "Contract",
        resourceId: activity.contract?._id,
        resourceName: activity.contract?.title || activity.contract?.name || activity.contract?.companyName,
        actor: activity.actor,
        contract: activity.contract,
        message: activity.message,
        createdAt: activity.createdAt,
        metadata: activity.metadata,
      });
    }

    // Sort all activities by createdAt (most recent first)
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Remove duplicates (same action, same resource, same time)
    const uniqueActivities = [];
    const seen = new Set();
    for (const activity of activities) {
      const key = `${activity.action}-${activity.resourceId}-${new Date(activity.createdAt).getTime()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueActivities.push(activity);
      }
    }

    // Return top N activities
    res.status(200).json({
      status: "success",
      data: uniqueActivities.slice(0, limit),
    });
  } catch (error) {
    console.error("Recent Activities Error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch recent activities",
    });
  }
};
