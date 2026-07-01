import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesForSelect,
  getCategoryStats
} from '../controllers/blogCategoryController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Rotas para categorias do blog (leitura pública - usada no site)
router.get('/', listCategories);           // GET /api/blog/categories - Listar categorias com filtros
router.get('/stats', getCategoryStats);   // GET /api/blog/categories/stats - Estatísticas
router.get('/select', getCategoriesForSelect); // GET /api/blog/categories/select - Para select/dropdown
router.get('/:id', getCategory);          // GET /api/blog/categories/:id - Buscar por ID

// Escrita - somente admin
router.post('/', requireAdmin, createCategory);         // POST /api/blog/categories - Criar categoria
router.put('/:id', requireAdmin, updateCategory);       // PUT /api/blog/categories/:id - Atualizar categoria
router.delete('/:id', requireAdmin, deleteCategory);    // DELETE /api/blog/categories/:id - Excluir categoria

export default router; 