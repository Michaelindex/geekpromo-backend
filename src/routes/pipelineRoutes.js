import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  getStatus, start, stop, setMode, dryRunLog, failedLog,
  dedupSkippedLog, dedupActive, setTelegramEnabled,
  getCategoriesPublish, setCategoriesPublish,
} from '../controllers/pipelineController.js';

const router = Router();

// Todas as rotas exigem JWT admin
router.use(requireAdmin);

router.get('/status', getStatus);
router.post('/start', start);
router.post('/stop', stop);
router.post('/mode', setMode);
router.post('/telegram', setTelegramEnabled);
router.get('/dry-run', dryRunLog);
router.get('/failed', failedLog);
router.get('/dedup-skipped', dedupSkippedLog);
router.get('/dedup-active', dedupActive);
router.get('/categories-publish', getCategoriesPublish);
router.put('/categories-publish', setCategoriesPublish);

export default router;
