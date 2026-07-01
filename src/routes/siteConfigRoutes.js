import express from 'express';
import {
  getPublicConfig,
  getAllConfigs,
  getConfigByKey,
  createConfig,
  updateConfig,
  deleteConfig
} from '../controllers/siteConfigController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ========== ROTAS PÚBLICAS ==========
// GET /api/site-config/public/:key - Buscar configuração pública por chave
router.get('/public/:key', (req, res, next) => {
  console.log('🔍 [SITE CONFIG ROUTES] Rota pública chamada:', req.originalUrl);
  next();
}, getPublicConfig);

// ========== ROTAS ADMIN ==========
// GET /api/site-config - Listar todas as configurações
router.get('/', requireAdmin, (req, res, next) => {
  console.log('🔍 [SITE CONFIG ROUTES] Rota admin (todas) chamada:', req.originalUrl);
  next();
}, getAllConfigs);

// GET /api/site-config/:key - Buscar configuração por chave
router.get('/:key', requireAdmin, (req, res, next) => {
  console.log('🔍 [SITE CONFIG ROUTES] Rota admin (por key) chamada:', req.originalUrl);
  console.log('🔍 [SITE CONFIG ROUTES] Key:', req.params.key);
  next();
}, getConfigByKey);

// POST /api/site-config - Criar nova configuração
router.post('/', requireAdmin, createConfig);

// PUT /api/site-config/:key - Atualizar configuração
router.put('/:key', requireAdmin, updateConfig);

// DELETE /api/site-config/:key - Deletar configuração
router.delete('/:key', requireAdmin, deleteConfig);

export default router;
