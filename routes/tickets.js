import express from 'express';
import { protect } from '../middleware/auth.js';
import { getTickets, createTicket, updateTicket } from '../controllers/ticketController.js';
import ticketCommentsRouter from "./ticketComments.js";
import ticketTasksRouter from "./ticketTasks.js";
import ticketAttachmentsRouter from "./ticketAttachments.js";

const router = express.Router();

// All ticket operations require authentication
router.use(protect);

router.get('/', getTickets);
router.post('/', createTicket);
router.patch('/:ticketId', updateTicket);
router.use('/:ticketId/comments', ticketCommentsRouter);
router.use('/:ticketId/tasks', ticketTasksRouter);
router.use('/:ticketId/attachments', ticketAttachmentsRouter);

export default router;
