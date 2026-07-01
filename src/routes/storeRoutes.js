import express from 'express';
import {
  listStores,
  getStore,
  createStore,
  updateStore,
  deleteStore,
  getStoresForSelect,
  getStoreStats,
  listPublicStores,
  getPublicStoreBySlug,
  listPublicStoreProducts,
  listPublicStoreCoupons,
  getPublicStoreCounters,
  trackStoreClick
} from '../controllers/storeController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ========== ROTAS PRINCIPAIS (admin) ==========

// GET /api/stores - Listar lojas com filtros e paginação
router.get('/', requireAdmin, listStores);

// GET /api/stores/select - Obter lojas para select (apenas id e name)
router.get('/select', requireAdmin, getStoresForSelect);

// GET /api/stores/stats - Obter estatísticas das lojas
router.get('/stats', requireAdmin, getStoreStats);

// GET /api/stores/:id - Obter loja específica por ID
router.get('/:id', requireAdmin, getStore);

// POST /api/stores - Criar nova loja
router.post('/', requireAdmin, createStore);

// PUT /api/stores/:id - Atualizar loja existente
router.put('/:id', requireAdmin, updateStore);

// DELETE /api/stores/:id - Deletar loja
router.delete('/:id', requireAdmin, deleteStore);

// ========== ROTAS PÚBLICAS ==========
// GET /api/stores/public/all - Listar todas as lojas ativas
router.get('/public/all', listPublicStores);
// GET /api/stores/public/:slug - Obter loja ativa por slug
router.get('/public/:slug', getPublicStoreBySlug);
// GET /api/stores/public/:slug/products - Listar produtos publicados da loja
router.get('/public/:slug/products', listPublicStoreProducts);
// GET /api/stores/public/:slug/coupons - Listar cupons ativos da loja
router.get('/public/:slug/coupons', listPublicStoreCoupons);
// GET /api/stores/public/:slug/counters - Contadores rápidos
router.get('/public/:slug/counters', getPublicStoreCounters);

// ========== ROTAS DE TRACKING ==========
// POST /api/stores/:id/track-click - Tracking de clique em loja
router.post('/:id/track-click', trackStoreClick);

export default router; 