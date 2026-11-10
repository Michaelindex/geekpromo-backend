import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  getState, validate, getJob, join, setEnabled, setMode, setOrder, relink, remove,
  getStats, getEvents, getAvatar,
} from '../controllers/landingController.js';

const router = Router();

router.use(requireAdmin);

router.get('/', getState);
router.post('/validate', validate);
router.get('/jobs/:id', getJob);
router.post('/join', join);
router.put('/enabled', setEnabled);
router.put('/mode', setMode);
router.put('/order', setOrder);
router.get('/stats', getStats);
router.get('/events', getEvents);
router.post('/groups/:id/relink', relink);
router.delete('/groups/:id', remove);
router.get('/groups/:id/avatar', getAvatar);

export default router;
