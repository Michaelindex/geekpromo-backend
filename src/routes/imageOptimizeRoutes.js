import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAdmin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Usar memória para evitar I/O intermediário
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const ensureDirSync = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // noop
  }
};

const buildUploadsPath = (...parts) => {
  return path.join(__dirname, '..', '..', 'uploads', ...parts);
};

// Gera nomes seguros de arquivos
const safeBase = (name) => {
  return (name || 'image')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .substring(0, 80);
};

// POST /api/tools/optimize-image
// multipart/form-data, campo: image
// Opções (query):
// - keepOriginal=true|false (default: false) → salvar cópia JPEG básica além das variações OG
router.post('/optimize-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Arquivo não enviado (campo "image")' });
    }

    // Pasta de destino: uploads/_optimized/YYYY/MM/
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const destDir = buildUploadsPath('_optimized', year, month);
    ensureDirSync(destDir);

    const baseName = safeBase(req.file.originalname);
    const commonOptions = {
      mozjpeg: true,
      progressive: true,
      quality: 82
    };

    // 1) JPEG “normal” (máx 1600px no maior lado) - opcional
    const keepOriginal = String(req.query.keepOriginal || 'false').toLowerCase() === 'true';
    let jpegMainUrl = null;
    if (keepOriginal) {
      const mainName = `${baseName}-jpg.jpg`;
      const mainPath = path.join(destDir, mainName);
      await sharp(req.file.buffer)
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg(commonOptions)
        .toFile(mainPath);
      jpegMainUrl = `/uploads/_optimized/${year}/${month}/${mainName}`;
    }

    // 2) OG 1200x630 - preservar conteúdo (sem cortes), usando contain + fundo branco
    const ogWideName = `${baseName}-og-1200x630.jpg`;
    const ogWidePath = path.join(destDir, ogWideName);
    await sharp(req.file.buffer)
      .resize(1200, 630, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg(commonOptions)
      .toFile(ogWidePath);
    const ogWideUrl = `/uploads/_optimized/${year}/${month}/${ogWideName}`;

    // 3) Fallback quadrado 600x600 - preservar conteúdo (sem cortes), usando contain + fundo branco
    const ogSquareName = `${baseName}-og-600x600.jpg`;
    const ogSquarePath = path.join(destDir, ogSquareName);
    await sharp(req.file.buffer)
      .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .jpeg(commonOptions)
      .toFile(ogSquarePath);
    const ogSquareUrl = `/uploads/_optimized/${year}/${month}/${ogSquareName}`;

    // Montar resposta com metadados rápidos
    const stat = (p) => {
      try {
        const s = fs.statSync(p);
        return { bytes: s.size };
      } catch {
        return { bytes: 0 };
      }
    };

    return res.json({
      success: true,
      message: 'Imagem otimizada com sucesso',
      results: {
        jpegMain: jpegMainUrl,
        ogWide: ogWideUrl,
        ogSquare: ogSquareUrl
      },
      sizes: {
        ...(jpegMainUrl ? { jpegMain: stat(ogWidePath.replace('-og-1200x630.jpg', '-jpg.jpg')) } : {}),
        ogWide: stat(ogWidePath),
        ogSquare: stat(ogSquarePath)
      }
    });
  } catch (error) {
    console.error('Erro ao otimizar imagem:', error);
    return res.status(500).json({ success: false, error: 'Erro ao processar imagem' });
  }
});

export default router;


