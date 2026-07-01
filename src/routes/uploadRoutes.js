import { Router } from 'express';
import { uploadImageMiddleware, uploadImage, handleUploadError } from '../controllers/uploadController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /api/uploads/image - Upload de imagem
router.post('/image', requireAdmin, uploadImageMiddleware, uploadImage, handleUploadError);

export default router; 