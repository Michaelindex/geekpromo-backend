import { Router } from 'express';
import { 
  getSummary, 
  getTopProducts, 
  getTopCoupons,
  getTopCategoriesWithMetrics,
  getVisitsLast14Days,
  getCategoryPerformance,
  getStoreDistribution,
  getRecentActivity
} from '../controllers/adminDashboardController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

// GET /api/admin/dashboard/summary
router.get('/summary', getSummary);

// GET /api/admin/dashboard/top-products
router.get('/top-products', getTopProducts);

// GET /api/admin/dashboard/top-coupons
router.get('/top-coupons', getTopCoupons);

// GET /api/admin/dashboard/top-categories-metrics
router.get('/top-categories-metrics', getTopCategoriesWithMetrics);

// GET /api/admin/dashboard/visits-14days
router.get('/visits-14days', getVisitsLast14Days);

// GET /api/admin/dashboard/category-performance
router.get('/category-performance', getCategoryPerformance);

// GET /api/admin/dashboard/store-distribution
router.get('/store-distribution', getStoreDistribution);

// GET /api/admin/dashboard/recent-activity
router.get('/recent-activity', getRecentActivity);

export default router; 