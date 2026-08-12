import Contract from "../models/ContractV3.js";
import PaymentSchedule from "../models/PaymentSchedule.js";
import Invoice from "../models/InvoiceV3.js";
import Receipt from "../models/Receipt.js";

export const getContractsDashboard = async (req, res) => {
  try {
    const { organization } = req.query;

    const contractQuery = { isArchived: false };
    if (organization) {
      contractQuery.organization = organization;
    }

    const [
      totalContracts,
      activeContracts,
      totalValue,
      upcomingPayments,
      overduePayments,
      totalPaid,
      totalPending,
    ] = await Promise.all([
      Contract.countDocuments(contractQuery),
      Contract.countDocuments({
        ...contractQuery,
        endDate: { $gte: new Date() },
      }),
      Contract.aggregate([
        { $match: contractQuery },
        { $group: { _id: null, total: { $sum: "$totalContractValue" } } },
      ]),
      PaymentSchedule.countDocuments({
        status: "Pending",
        dueDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      }),
      PaymentSchedule.countDocuments({
        status: "Overdue",
      }),
      PaymentSchedule.aggregate([
        { $match: { status: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      PaymentSchedule.aggregate([
        { $match: { status: "Pending" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const stats = {
      contracts: {
        total: totalContracts,
        active: activeContracts,
        totalValue: totalValue[0]?.total || 0,
      },
      payments: {
        upcoming: upcomingPayments,
        overdue: overduePayments,
        totalPaid: totalPaid[0]?.total || 0,
        totalPending: totalPending[0]?.total || 0,
      },
    };

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
