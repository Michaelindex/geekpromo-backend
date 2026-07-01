import { Router } from 'express';
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getPostStats,
  getPostCategories,
  setPostCategories,
  addPostCategories,
  removePostCategory,
  incrementPostViews,
  listPublishedPosts,
  getPublishedPostBySlug
} from '../controllers/blogPostController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Rotas administrativas para posts do blog
router.get('/', requireAdmin, listPosts);               // GET /api/blog/posts - Listar posts com filtros
router.get('/stats', requireAdmin, getPostStats);       // GET /api/blog/posts/stats - Estatísticas
router.get('/:id', requireAdmin, getPost);              // GET /api/blog/posts/:id - Buscar por ID
router.post('/', requireAdmin, createPost);             // POST /api/blog/posts - Criar post
router.put('/:id', requireAdmin, updatePost);           // PUT /api/blog/posts/:id - Atualizar post
router.delete('/:id', requireAdmin, deletePost);        // DELETE /api/blog/posts/:id - Excluir post

// Rotas para gerenciar categorias dos posts
router.get('/:id/categories', requireAdmin, getPostCategories);      // GET /api/blog/posts/:id/categories - Listar categorias do post
router.put('/:id/categories', requireAdmin, setPostCategories);      // PUT /api/blog/posts/:id/categories - Definir categorias do post
router.post('/:id/categories', requireAdmin, addPostCategories);     // POST /api/blog/posts/:id/categories - Adicionar categorias ao post
router.delete('/:id/categories/:categoryId', requireAdmin, removePostCategory); // DELETE /api/blog/posts/:id/categories/:categoryId - Remover categoria do post

// Rotas públicas (para uso futuro no front público)
router.get('/public/posts', listPublishedPosts);       // GET /api/blog/posts/public/posts - Listar posts publicados
router.get('/public/posts/:slug', getPublishedPostBySlug); // GET /api/blog/posts/public/posts/:slug - Buscar post por slug
router.post('/public/posts/:id/view', incrementPostViews); // POST /api/blog/posts/public/posts/:id/view - Incrementar views

export default router; 