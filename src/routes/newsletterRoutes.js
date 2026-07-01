import express from 'express';
import { subscribe } from '../controllers/newsletterController.js';

const router = express.Router();

// ========== ROTAS PÚBLICAS ==========

// POST /api/newsletter/subscribe - Inscrever e-mail na newsletter
router.post('/subscribe', subscribe);

export default router;
