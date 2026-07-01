import express from 'express';
import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponsForSelect,
  getCouponStats,
  listPublicCoupons,
  trackCouponClick,
  getCouponByPromotionId
} from '../controllers/couponController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Rotas públicas
router.get('/public', listPublicCoupons);  // GET /api/coupons/public - Listar cupons públicos
router.post('/:id/track-click', trackCouponClick); // POST /api/coupons/:id/track-click - Tracking de clique

// Rotas principais (admin)
router.get('/', requireAdmin, listCoupons);              // GET /api/coupons - Listar cupons com filtros
router.get('/stats', requireAdmin, getCouponStats);      // GET /api/coupons/stats - Estatísticas
router.get('/select', requireAdmin, getCouponsForSelect); // GET /api/coupons/select - Para selects
router.get('/by-promotion/:promotionId', requireAdmin, getCouponByPromotionId); // GET /api/coupons/by-promotion/:promotionId
router.get('/:id', requireAdmin, getCoupon);             // GET /api/coupons/:id - Obter cupom por ID
router.post('/', requireAdmin, createCoupon);            // POST /api/coupons - Criar cupom
router.put('/:id', requireAdmin, updateCoupon);          // PUT /api/coupons/:id - Atualizar cupom
router.delete('/:id', requireAdmin, deleteCoupon);       // DELETE /api/coupons/:id - Deletar cupom

export default router; 