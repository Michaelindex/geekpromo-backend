import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  getMeta,
  getAvatar,
  listChannels,
  createChannel,
  updateChannel,
  verifyChannel,
  setChannelCategories,
  toggleChannel,
  deleteChannel,
} from '../controllers/telegramOutputChannelsController.js';

const router = Router();

router.use(requireAdmin);

router.get('/meta', getMeta);
router.get('/', listChannels);
router.get('/:id/avatar', getAvatar);
router.post('/', createChannel);
router.put('/:id', updateChannel);
router.post('/:id/verify', verifyChannel);
router.put('/:id/categories', setChannelCategories);
router.post('/:id/toggle', toggleChannel);
router.delete('/:id', deleteChannel);

export default router;
