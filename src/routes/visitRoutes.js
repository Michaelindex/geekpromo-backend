import { Router } from 'express';
import { registerVisit, getVisitStats, getVisitSummary } from '../controllers/visitController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /api/visit - Registrar visita (público)
router.post('/', registerVisit);

// GET /api/admin/visits - Estatísticas com filtros (admin)
// Nota: este router também é montado em /api/visit, mas como o método é GET
// (o público só usa POST /), proteger aqui não afeta o fluxo público.
router.get('/', requireAdmin, getVisitStats);

// GET /api/admin/visits/summary - Resumo rápido (admin)
router.get('/summary', requireAdmin, getVisitSummary);

export default router;

