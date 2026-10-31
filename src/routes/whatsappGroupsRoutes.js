import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  getStatus,
  listGroups,
  pair,
  resume,
  pause,
  setSink,
  setCapture,
  resolveGroup,
  getJob,
  joinGroup,
  importGroups,
  toggleGroup,
  updateStoreFilters,
  refreshGroup,
  leaveGroup,
  getAvatar,
} from '../controllers/whatsappGroupsController.js';

const router = Router();

router.use(requireAdmin);

router.get('/status', getStatus);
router.post('/pair', pair);
router.post('/resume', resume);
router.post('/pause', pause);
router.put('/sink', setSink);
router.put('/capture', setCapture);
router.post('/resolve', resolveGroup);
router.get('/jobs/:id', getJob);
router.post('/join', joinGroup);
router.post('/import', importGroups);
router.get('/', listGroups);
router.post('/:username/toggle', toggleGroup);
router.put('/:username/store-filters', updateStoreFilters);
router.post('/:username/refresh', refreshGroup);
router.delete('/:username', leaveGroup);
router.get('/:username/avatar', getAvatar);

export default router;
