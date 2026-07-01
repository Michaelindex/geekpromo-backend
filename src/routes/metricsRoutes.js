import { Router } from 'express';
import { 
  getPromotionViewsMetrics,
  getCouponCopiesMetrics
} from '../controllers/metricsController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/metrics/promotions/views
router.get('/promotions/views', getPromotionViewsMetrics);

// GET /api/admin/metrics/coupons/copies
router.get('/coupons/copies', getCouponCopiesMetrics);

export default router;


