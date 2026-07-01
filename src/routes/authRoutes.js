import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login } from '../controllers/authController.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP nesse período
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas de login. Tente novamente mais tarde.' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, login);

export default router;
