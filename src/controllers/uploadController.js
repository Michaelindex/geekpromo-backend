import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import sharp from 'sharp';

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads/products';
    
    // Criar subpasta por ano/mês
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fullPath = path.join(uploadDir, year.toString(), month);
    
    // Criar diretório se não existir
    fs.mkdirSync(fullPath, { recursive: true });
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Gerar nome único com extensão original
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// Filtro para tipos de arquivo
const fileFilter = (req, file, cb) => {
  const allowedMimes = (process.env.ALLOWED_MIME || 'image/jpeg,image/png,image/webp').split(',');
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido. Permitidos: ${allowedMimes.join(', ')}`), false);
  }
};

// Configuração do upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024, // MB para bytes
    files: 1 // Apenas um arquivo por vez
  }
});

// Middleware para upload de imagem
export const uploadImageMiddleware = upload.single('image');

// Controller para upload de imagem
export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }
    
    // Construir URL completa do arquivo
    const protocol = req.secure ? "https" : "http";
    const host = req.get('host');
    const relativePath = req.file.path.replace(/\\/g, '/'); // Normalizar barras para URLs
    const url = `${protocol}://${host}/${relativePath}`;
    
    // Gerar derivados otimizados SEM alterar o fluxo atual
    // uploads/products/YYYY/MM/<uuid>.<ext>  ->  uploads/_optimized/YYYY/MM/<uuid>-*.jpg
    const pathParts = relativePath.split('/'); // uploads, products, YYYY, MM, filename
    let optimized = null;
    try {
      const idx = pathParts.findIndex(p => p === 'uploads');
      if (idx !== -1 && pathParts[idx + 1] === 'products') {
        const year = pathParts[idx + 2];
        const month = pathParts[idx + 3];
        const filename = pathParts[idx + 4] || '';
        const base = filename.replace(/\.[a-z0-9]+$/i, '');
        const optimizedDir = path.join('uploads', '_optimized', year, month);
        fs.mkdirSync(optimizedDir, { recursive: true });
        const srcPath = req.file.path;
        const commonOptions = { mozjpeg: true, progressive: true, quality: 82 };
        // principal (máx 1600 inside)
        const mainName = `${base}-jpg.jpg`;
        const mainPath = path.join(optimizedDir, mainName);
        await sharp(srcPath)
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .jpeg(commonOptions)
          .toFile(mainPath);
        // square fallback 600x600 contain
        const sqName = `${base}-og-600x600.jpg`;
        const sqPath = path.join(optimizedDir, sqName);
        await sharp(srcPath)
          .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
          .jpeg(commonOptions)
          .toFile(sqPath);
        // wide fallback 1200x630 contain
        const wideName = `${base}-og-1200x630.jpg`;
        const widePath = path.join(optimizedDir, wideName);
        await sharp(srcPath)
          .resize(1200, 630, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
          .jpeg(commonOptions)
          .toFile(widePath);
        optimized = {
          main: `${protocol}://${host}/uploads/_optimized/${year}/${month}/${mainName}`,
          ogSquare: `${protocol}://${host}/uploads/_optimized/${year}/${month}/${sqName}`,
          ogWide: `${protocol}://${host}/uploads/_optimized/${year}/${month}/${wideName}`,
        };
      }
    } catch (e) {
      console.error('Erro ao gerar derivados otimizados:', e.message);
    }
    
    // Log de auditoria
    console.log(`Upload realizado: ${req.file.filename} (${req.file.size} bytes) por IP ${req.ip}`);
    
    res.status(200).json({
      success: true,
      data: {
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: relativePath,
        optimized // inclui URLs da imagem principal compactada e fallbacks
      },
      message: 'Imagem enviada com sucesso'
    });
    
  } catch (error) {
    next(error);
  }
};

// Middleware de tratamento de erros específicos do multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: `Arquivo muito grande. Tamanho máximo: ${process.env.MAX_FILE_SIZE_MB || 5}MB`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Apenas um arquivo por vez é permitido'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Campo de arquivo inesperado'
        });
      default:
        return res.status(400).json({
          success: false,
          error: `Erro de upload: ${err.message}`
        });
    }
  }
  
  if (err.message.includes('Tipo de arquivo não permitido')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  
  next(err);
}; 