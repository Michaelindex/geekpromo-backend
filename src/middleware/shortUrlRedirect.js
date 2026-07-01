import ShortUrl from '../models/ShortUrl.js';

/**
 * Middleware para redirecionamento de URLs curtas
 * 
 * Este middleware intercepta requisições para /p/:slug e verifica se o slug
 * corresponde a uma URL curta. Se sim, faz redirect 301 para a URL original.
 * Se não, continua o fluxo normal para o produto.
 */
export const handleShortUrlRedirect = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    // Verificar se é um slug curto
    const shortUrl = await ShortUrl.findBySlug(slug);
    
    if (shortUrl && shortUrl.product_slug) {
      // Detectar de forma robusta se é rota de API
      const acceptHeader = req.headers.accept || '';
      const isApiRequest = (
        (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
        (req.baseUrl && req.baseUrl.startsWith('/api/')) ||
        acceptHeader.includes('application/json')
      );

      if (isApiRequest) {
        // Em rotas de API NÃO redirecionamos; apenas resolvemos o slug
        req.params.slug = shortUrl.product_slug;
        console.log(`📝 [SHORT-URL] API: ${slug} → ${shortUrl.product_slug}`);
        return next();
      }

      // Requisição de página HTML → redirecionar para canônica
      const originalUrl = `/p/${shortUrl.product_slug}`;
      console.log(`🔗 [SHORT-URL] Page redirect ${slug} → ${shortUrl.product_slug}`);
      return res.redirect(301, originalUrl);
    }
    
    // Se não é slug curto, continuar para o produto normal
    next();
  } catch (error) {
    console.error('❌ [SHORT-URL] Erro no middleware de redirecionamento:', error);
    // Em caso de erro, continuar o fluxo normal
    next();
  }
};

/**
 * Middleware para verificar se slug existe (para APIs)
 * 
 * Usado para verificar se um slug curto existe sem fazer redirecionamento
 */
export const checkShortUrlExists = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const shortUrl = await ShortUrl.findBySlug(slug);
    
    // Adicionar informação ao request
    req.shortUrl = shortUrl;
    req.isShortUrl = !!shortUrl;
    
    next();
  } catch (error) {
    console.error('❌ [SHORT-URL] Erro ao verificar slug curto:', error);
    req.shortUrl = null;
    req.isShortUrl = false;
    next();
  }
};

/**
 * Middleware para logging de acesso a URLs curtas
 */
export const logShortUrlAccess = async (req, res, next) => {
  try {
    if (req.isShortUrl && req.shortUrl) {
      console.log(`📊 [SHORT-URL] Acesso: ${req.shortUrl.short_slug} → ${req.shortUrl.product_slug} (${req.ip})`);
      
      // Aqui você pode implementar analytics se necessário
      // Por exemplo, incrementar contador de acessos
    }
    
    next();
  } catch (error) {
    console.error('❌ [SHORT-URL] Erro no logging:', error);
    next();
  }
};
