import express from 'express';
import {
  listProductShortUrls,
  createAutoShortUrl,
  createCustomShortUrl,
  updateShortUrl,
  deleteShortUrl,
  checkSlugAvailability,
  generateSlugPreview,
  copyShortUrl,
  createCouponUrl,
  getShortUrlBySlug
} from '../controllers/shortUrlController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

console.log('🔗 [SHORT-URL] Rotas carregadas com sucesso!');

// Rotas para URLs curtas de produtos específicos (gestão - admin)
router.get('/products/:id/short-urls', requireAdmin, listProductShortUrls);
router.post('/products/:id/short-urls/auto', requireAdmin, createAutoShortUrl);
router.post('/products/:id/short-urls/custom', requireAdmin, createCustomShortUrl);
router.put('/products/:productId/short-urls/:id', requireAdmin, updateShortUrl);
router.delete('/products/:productId/short-urls/:id', requireAdmin, deleteShortUrl);
router.get('/products/:id/short-urls/copy', requireAdmin, copyShortUrl);

// Rota para URL curta de cupom (admin)
router.post('/products/:id/coupon-url', requireAdmin, createCouponUrl);

// Rotas utilitárias (admin)
router.get('/short-urls/check/:slug', requireAdmin, checkSlugAvailability);
router.post('/short-urls/generate-preview', requireAdmin, generateSlugPreview);

// Rota para buscar URL por slug (redirecionamento) - DEVE vir por último
router.get('/:slug', (req, res, next) => {
  console.log('🔍 [SHORT URL ROUTES] Interceptando requisição:', req.originalUrl);
  console.log('🔍 [SHORT URL ROUTES] Slug:', req.params.slug);
  console.log('🔍 [SHORT URL ROUTES] Method:', req.method);
  next();
}, getShortUrlBySlug);

export default router;
