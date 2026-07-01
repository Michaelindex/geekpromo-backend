import { Router } from 'express';
import { 
  listProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  redirectToPartner,
  getProductCategories,
  setProductCategories,
  addProductCategories,
  removeProductCategory,
  getProductStats,
  getPublicProductBySlug,
  incrementPublicProductView,
  getRelatedProducts,
  publishScheduledPromotions,
  expirePromotions,
  listScheduledPromotions,
  runAutomation,
  getPromotionsByCategory,
  searchProducts,
  getDailyPromotions,
  getMostViewedProducts,
  incrementAlternativeLinkClick
} from '../controllers/productController.js';
import { handleShortUrlRedirect, checkShortUrlExists, logShortUrlAccess } from '../middleware/shortUrlRedirect.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/products/stats - Obter estatísticas dos produtos (admin)
router.get('/stats', requireAdmin, getProductStats);

// GET /api/products - Listar produtos (admin)
router.get('/', requireAdmin, listProducts);

// GET /api/products/public/:slug - Obter produto publicado por slug (público) com suporte a URLs curtas
router.get('/public/:slug', checkShortUrlExists, logShortUrlAccess, handleShortUrlRedirect, getPublicProductBySlug);
router.post('/public/:slug/view', incrementPublicProductView);
router.post('/public/alternative-link/:linkId/click', incrementAlternativeLinkClick);

// GET /api/products/public/:slug/related - Obter produtos relacionados (público) com suporte a URLs curtas
router.get('/public/:slug/related', checkShortUrlExists, logShortUrlAccess, handleShortUrlRedirect, getRelatedProducts);

// GET /api/products/category/:slug - Obter promoções por categoria (público)
router.get('/category/:slug', getPromotionsByCategory);

// GET /api/products/search - Buscar produtos por termo (público)
router.get('/search', searchProducts);

// GET /api/products/daily - Obter promoções do dia (público)
router.get('/daily', getDailyPromotions);

// GET /api/products/most-viewed - Obter produtos mais vistos (público)
router.get('/most-viewed', getMostViewedProducts);

// GET /api/products/:id - Obter produto por ID (admin)
router.get('/:id', requireAdmin, getProduct);

// GET /api/products/:id/go - Redirecionar para link do parceiro (público)
router.get('/:id/go', redirectToPartner);

// POST /api/products - Criar produto
router.post('/', requireAdmin, createProduct);

// PUT /api/products/:id - Atualizar produto
router.put('/:id', requireAdmin, updateProduct);

// DELETE /api/products/:id - Deletar produto
router.delete('/:id', requireAdmin, deleteProduct);

// ========== ROTAS DE CATEGORIA ==========

// GET /api/products/:id/categories - Obter categorias do produto
router.get('/:id/categories', requireAdmin, getProductCategories);

// PUT /api/products/:id/categories - Definir categorias do produto (substitui todas)
router.put('/:id/categories', requireAdmin, setProductCategories);

// POST /api/products/:id/categories - Adicionar categorias ao produto (merge)
router.post('/:id/categories', requireAdmin, addProductCategories);

// DELETE /api/products/:id/categories/:categoryId - Remover categoria específica
router.delete('/:id/categories/:categoryId', requireAdmin, removeProductCategory);

// ========== ROTAS DE AUTOMAÇÃO DE DATAS ==========

// POST /api/products/automation/publish - Publicar promoções agendadas
router.post('/automation/publish', requireAdmin, publishScheduledPromotions);

// POST /api/products/automation/expire - Expirar promoções
router.post('/automation/expire', requireAdmin, expirePromotions);

// POST /api/products/automation/run - Executar automação completa
router.post('/automation/run', requireAdmin, runAutomation);

// GET /api/products/scheduled - Listar promoções agendadas
router.get('/scheduled', requireAdmin, listScheduledPromotions);

// ========== ROTAS DE CONTROLE DO SCHEDULER ==========

// GET /api/products/automation/status - Status do scheduler
router.get('/automation/status', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    const status = scheduler.status();
    
    res.json({
      success: true,
      data: status,
      message: 'Status do sistema de automação'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/products/automation/start - Iniciar scheduler
router.post('/automation/start', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    scheduler.start();
    
    res.json({
      success: true,
      message: 'Sistema de automação iniciado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/products/automation/stop - Parar scheduler
router.post('/automation/stop', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    scheduler.stop();
    
    res.json({
      success: true,
      message: 'Sistema de automação parado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/products/automation/restart - Reiniciar scheduler
router.post('/automation/restart', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    scheduler.restart();
    
    res.json({
      success: true,
      message: 'Sistema de automação reiniciado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/products/automation/run-now - Executar automação imediatamente
router.post('/automation/run-now', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    const result = await scheduler.runNow();
    
    res.json({
      success: true,
      data: result,
      message: 'Automação executada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/products/automation/jobs - Listar jobs dinâmicos ativos
router.get('/automation/jobs', requireAdmin, async (req, res) => {
  try {
    const { default: scheduler } = await import('../scheduler.js');
    const activeJobs = scheduler.getActiveJobs();
    
    res.json({
      success: true,
      data: {
        activeJobs,
        count: activeJobs.length
      },
      message: `${activeJobs.length} jobs dinâmicos ativos`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


export default router; 