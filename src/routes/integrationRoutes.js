import express from 'express';
import { sendPromotionMessage } from '../controllers/telegramController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// POST /api/integrations/telegram/send-promotion
router.post('/telegram/send-promotion', requireAdmin, sendPromotionMessage);

export default router;


