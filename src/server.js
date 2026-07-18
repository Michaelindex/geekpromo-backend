import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import { testConnection } from './config/database.js';
import productRoutes from './routes/productRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import blogPostRoutes from './routes/blogPostRoutes.js';
import blogCategoryRoutes from './routes/blogCategoryRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import siteConfigRoutes from './routes/siteConfigRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import scheduler from './scheduler.js';
import shortUrlRoutes from './routes/shortUrlRoutes.js';
import redirectRoutes from './routes/redirectRoutes.js';
import visitRoutes from './routes/visitRoutes.js';
import imageOptimizeRoutes from './routes/imageOptimizeRoutes.js';
import metricsRoutes from './routes/metricsRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import pipelineRoutes from './routes/pipelineRoutes.js';
import telegramGroupsRoutes from './routes/telegramGroupsRoutes.js';

// Para obter __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:5174', 
    'http://localhost:8080',
    'http://geekpromo.com.br',
    'https://geekpromo.com.br',
    'http://geekpromo.com.br:8080',
    'https://geekpromo.com.br:8080',
    'http://72.60.10.64:8080',
    'https://72.60.10.64:8080',
    'http://72.60.10.64',
    'https://72.60.10.64'
  ],
  credentials: true
}));
app.use(cookieParser()); // Para gerenciar cookies (necessário para contador de visitas)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🧹 MIDDLEWARE: FORÇAR LIMPEZA DE CACHE DO NAVEGADOR (APENAS PÁGINA INICIAL)
// Adiciona header Clear-Site-Data APENAS para a página inicial
app.use((req, res, next) => {
  // 🎯 APLICAR APENAS PARA A PÁGINA INICIAL (/) - NÃO para links encurtados
  const isHomePage = req.path === '/' && req.headers.accept?.includes('text/html');
  
  if (isHomePage) {
    console.log('🧹 [CACHE] Enviando header Clear-Site-Data APENAS para página inicial:', req.url);
    // 🗑️ LIMPAR CACHE, COOKIES E STORAGE (apenas na home)
    res.set('Clear-Site-Data', '"cache", "storage", "cookies"');
    
    // 🚫 DESABILITAR CACHE HTTP (apenas na home)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  } else {
    // 🔧 Para outras páginas, apenas desabilitar cache HTTP (sem Clear-Site-Data)
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
  
  next();
});

// Servir arquivos estáticos de uploads
const uploadDir = 'uploads'; // Pasta raiz dos uploads
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Geekloko API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      products: '/api/products',
      categories: '/api/categories',
      stores: '/api/stores',
      coupons: '/api/coupons',
      uploads: '/api/uploads',
      blog_posts: '/api/blog/posts',
      blog_categories: '/api/blog/categories',
      admin_dashboard: '/api/admin/dashboard'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/site-config', siteConfigRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/blog', blogPostRoutes);
app.use('/api/blog-categories', blogCategoryRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/redirect', redirectRoutes);
app.use('/api/visit', visitRoutes); // Registro de visitas (público)
app.use('/api/admin/visits', visitRoutes); // Estatísticas de visitas (admin)
app.use('/api/tools', imageOptimizeRoutes); // Endpoint independente de otimização
app.use('/api/admin/metrics', metricsRoutes); // KPIs com filtros de período
app.use('/api/integrations', integrationRoutes); // Integrações externas (ex: Telegram)
app.use('/api/admin/pipeline', pipelineRoutes); // Pipeline geekpromo-auto (admin only)
app.use('/api/admin/telegram-groups', telegramGroupsRoutes); // Grupos monitorados pelo listener MTProto

// Registrar rotas de Short URLs (DEVE vir por último)
app.use('/api', shortUrlRoutes);

// Rota para redirecionamento de URLs curtas (DEVE vir antes das rotas de API)
app.get('/p/:slug', async (req, res) => {
  const { slug } = req.params;
  
  try {
    // Importar o modelo ShortUrl
    const { default: ShortUrl } = await import('./models/ShortUrl.js');
    
    // Buscar a URL curta no banco
    const shortUrl = await ShortUrl.findBySlug(slug);
    
    if (!shortUrl) {
      return res.status(404).send('URL curta não encontrada');
    }

    // Buscar o produto para obter o slug real
    const { default: Product } = await import('./models/Product.js');
    const product = await Product.findById(shortUrl.product_id);
    
    if (!product) {
      return res.status(404).send('Produto não encontrado');
    }

    // Log do acesso (opcional)
    console.log(`Redirecionamento: /p/${slug} -> /p/${product.slug}`);
    
    // Fazer redirecionamento 301 para a página real do produto no domínio público (porta 443)
    res.redirect(301, `https://geekpromo.com.br/p/${product.slug}`);
    
  } catch (error) {
    console.error('Erro no redirecionamento:', error);
    res.status(500).send('Erro interno do servidor');
  }
});
app.use('/api/categories', categoryRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/blog/posts', blogPostRoutes);
app.use('/api/blog/categories', blogCategoryRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Rota não encontrada'
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Iniciar servidor HTTPS
async function startServer() {
  try {
    // Testar conexão com banco de dados
    await testConnection();
    
    // Configuração HTTPS
    const httpsOptions = {
      key: fs.readFileSync('/etc/letsencrypt/live/geekpromo.com.br/privkey.pem'),
      cert: fs.readFileSync('/etc/letsencrypt/live/geekpromo.com.br/fullchain.pem')
    };
    
    // Criar servidor HTTPS
    const server = https.createServer(httpsOptions, app);
    
    server.listen(PORT, () => {
      console.log(`🚀 Servidor HTTPS rodando na porta ${PORT}`);
      console.log(`📊 Health check: https://geekpromo.com.br:${PORT}/health`);
      console.log(`🌐 API Base: https://geekpromo.com.br:${PORT}/`);
      console.log(`📁 Uploads estáticos: https://geekpromo.com.br:${PORT}/uploads/`);
      
      // Confirmar rotas registradas
      console.log(`📌 Rotas registradas:`);
      console.log(`  - /api/products (incluindo short-urls)`);
      console.log(`  - /api/short-urls/*`);
      
      // Iniciar scheduler de automação
      console.log(`⚡ Iniciando sistema de automação de promoções...`);
      scheduler.start();
      console.log(`✅ Sistema HTTPS completo iniciado com sucesso!`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor HTTPS:', error);
    process.exit(1);
  }
}

startServer(); 