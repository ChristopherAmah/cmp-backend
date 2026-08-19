import express from "express";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";
import {
  getTicketTasks,
  createTicketTask,
  updateTicketTask,
} from "../controllers/ticketTaskController.js";

const router = express.Router({ mergeParams: true });

router.use(protect);
router.get("/", getTicketTasks);
router.post("/", authorize("admin", "super_admin", "support_lead"), createTicketTask);
router.patch("/:taskId", updateTicketTask);

export default router;
