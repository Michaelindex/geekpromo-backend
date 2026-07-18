import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  listGroups,
  toggleGroup,
  refreshGroups,
  getAvatar,
} from '../controllers/telegramGroupsController.js';

const router = Router();

router.use(requireAdmin);

router.get('/', listGroups);
router.post('/refresh', refreshGroups);
router.post('/:username/toggle', toggleGroup);
router.get('/:username/avatar', getAvatar);

export default router;
