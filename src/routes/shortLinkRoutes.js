import express from 'express';
import {
  createShortLink,
  resolveShortLink,
  listShortLinks
} from '../controllers/shortLinkController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ⚠️ IMPORTANTE: este router precisa ser montado no server.js ANTES de
// `app.use('/api', shortUrlRoutes)`, porque aquele tem um catch-all
// `router.get('/:slug')` que engoliria /api/short-links.

// Público: consumido pelo https-server.js para resolver geekpromo.com.br/{code}
router.get('/resolve/:code', resolveShortLink);

// Admin: criação (usada pelo pipeline) e auditoria
router.post('/', requireAdmin, createShortLink);
router.get('/', requireAdmin, listShortLinks);

export default router;
