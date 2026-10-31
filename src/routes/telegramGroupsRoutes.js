import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  listGroups,
  getCapture,
  setCapture,
  toggleGroup,
  refreshGroups,
  getAvatar,
  resolveGroup,
  joinGroup,
  leaveGroup,
  updateStoreFilters,
} from '../controllers/telegramGroupsController.js';

const router = Router();

router.use(requireAdmin);

router.get('/', listGroups);
router.get('/capture', getCapture);
router.put('/capture', setCapture);
router.post('/refresh', refreshGroups);
router.post('/resolve', resolveGroup);
router.post('/join', joinGroup);
router.post('/:username/toggle', toggleGroup);
router.put('/:username/store-filters', updateStoreFilters);
router.delete('/:username', leaveGroup);
router.get('/:username/avatar', getAvatar);

export default router;
