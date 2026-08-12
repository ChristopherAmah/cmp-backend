import express from 'express';
import { protect } from '../middleware/auth.js';
import { getTickets, createTicket } from '../controllers/ticketController.js';
import ticketCommentsRouter from "./ticketComments.js";

const router = express.Router();

// All ticket operations require authentication
router.use(protect);

router.get('/', getTickets);
router.post('/', createTicket);
router.use('/:ticketId/comments', ticketCommentsRouter);

export default router;
