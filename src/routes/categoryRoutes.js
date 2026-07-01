import express from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesForSelect,
  getCategoryStats,
  getTopCategories,
  trackCategoryClick,
  forceDeleteCategory
} from '../controllers/categoryController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/categories - Listar categorias com paginação e filtros
router.get('/', listCategories);

// GET /api/categories/select - Listar categorias ativas para selects
router.get('/select', getCategoriesForSelect);

// GET /api/categories/stats - Estatísticas das categorias
router.get('/stats', getCategoryStats);

// GET /api/categories/top - Buscar top categorias ordenadas por número de produtos
router.get('/top', getTopCategories);

// GET /api/categories/:id - Buscar categoria por ID
router.get('/:id', getCategory);

// POST /api/categories - Criar nova categoria
router.post('/', requireAdmin, createCategory);

// PUT /api/categories/:id - Atualizar categoria
router.put('/:id', requireAdmin, updateCategory);

// DELETE /api/categories/:id - Deletar categoria
router.delete('/:id', requireAdmin, deleteCategory);

// ========== ROTAS DE TRACKING ==========
// POST /api/categories/:id/track-click - Tracking de clique em categoria (público)
router.post('/:id/track-click', trackCategoryClick);

// ========== ROTAS DE DELEÇÃO FORÇADA ==========
// POST /api/categories/:id/force-delete - Forçar deleção de categoria (remove vínculos e deleta)
router.post('/:id/force-delete', requireAdmin, forceDeleteCategory);

export default router; 