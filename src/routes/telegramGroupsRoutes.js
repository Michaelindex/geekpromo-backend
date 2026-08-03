import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  listGroups,
  toggleGroup,
  refreshGroups,
  getAvatar,
  resolveGroup,
  joinGroup,
  leaveGroup,
} from '../controllers/telegramGroupsController.js';

const router = Router();

router.use(requireAdmin);

router.get('/', listGroups);
router.post('/refresh', refreshGroups);
router.post('/resolve', resolveGroup);
router.post('/join', joinGroup);
router.post('/:username/toggle', toggleGroup);
router.delete('/:username', leaveGroup);
router.get('/:username/avatar', getAvatar);

export default router;
