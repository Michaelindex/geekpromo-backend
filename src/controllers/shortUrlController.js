import ShortUrl from '../models/ShortUrl.js';
import Product from '../models/Product.js';

/**
 * Listar URLs curtas de um produto
 * GET /api/products/:id/short-urls
 */
export const listProductShortUrls = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { include_inactive = 'false' } = req.query;

    // Verificar se produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Buscar URLs curtas do produto
    const isActive = include_inactive === 'true' ? undefined : true;
    const shortUrls = await ShortUrl.findByProductId(productId);

    // Separar automáticas e personalizadas APENAS do tipo 'product' (ou sem tipo)
    const isProductType = (u) => !u.url_type || u.url_type === 'product';
    const isCouponType = (u) => u.url_type === 'coupon';

    const autoUrl = shortUrls.find(url => !url.is_custom && isProductType(url));
    const customUrls = shortUrls.filter(url => url.is_custom && isProductType(url));
    const couponUrls = shortUrls.filter(isCouponType);

    const responseData = {
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug
      },
      auto_url: autoUrl,
      custom_urls: customUrls,
      coupon_urls: couponUrls
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar URL curta automática para um produto
 * POST /api/products/:id/short-urls/auto
 */
export const createAutoShortUrl = async (req, res, next) => {
  try {
    const { id: productId } = req.params;

    // Verificar se produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Verificar se já existe URL automática ativa
    const existingAuto = await ShortUrl.findByProductId(productId, false);
    if (existingAuto.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Produto já possui URL curta automática'
      });
    }

    // Gerar slug automático
    const autoSlug = await ShortUrl.generateAutoSlug(product.title);
    
    // Criar URL curta
    const shortUrl = await ShortUrl.create(productId, autoSlug, false);

    res.status(201).json({
      success: true,
      data: shortUrl,
      message: 'URL curta automática criada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar URL curta personalizada para um produto
 * POST /api/products/:id/short-urls/custom
 */
export const createCustomShortUrl = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { short_slug } = req.body;

    if (!short_slug) {
      return res.status(400).json({
        success: false,
        error: 'Campo short_slug é obrigatório'
      });
    }

    // Verificar se produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Validar slug
    const validation = await ShortUrl.validateSlug(short_slug);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Criar URL curta personalizada
    const shortUrl = await ShortUrl.create(productId, short_slug, true);

    res.status(201).json({
      success: true,
      data: shortUrl,
      message: 'URL curta personalizada criada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar URL curta
 * PUT /api/products/:productId/short-urls/:id
 */
export const updateShortUrl = async (req, res, next) => {
  try {
    const { productId, id } = req.params;
    const { short_slug, is_active } = req.body;

    // Verificar se URL curta existe e pertence ao produto
    const shortUrl = await ShortUrl.findById(id);
    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL curta não encontrada'
      });
    }

    if (shortUrl.product_id !== productId) {
      return res.status(403).json({
        success: false,
        error: 'URL curta não pertence a este produto'
      });
    }

    // Atualizar
    const updatedShortUrl = await ShortUrl.update(id, {
      short_slug,
      is_active
    });

    res.json({
      success: true,
      data: updatedShortUrl,
      message: 'URL curta atualizada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar URL curta
 * DELETE /api/products/:productId/short-urls/:id
 */
export const deleteShortUrl = async (req, res, next) => {
  try {
    const { productId, id } = req.params;

    // Verificar se URL curta existe e pertence ao produto
    const shortUrl = await ShortUrl.findById(id);
    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL curta não encontrada'
      });
    }

    if (shortUrl.product_id !== productId) {
      return res.status(403).json({
        success: false,
        error: 'URL curta não pertence a este produto'
      });
    }

    // Deletar
    const deleted = await ShortUrl.delete(id);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar URL curta'
      });
    }

    res.json({
      success: true,
      message: 'URL curta deletada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar disponibilidade de slug
 * GET /api/short-urls/check/:slug
 */
export const checkSlugAvailability = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { exclude_id } = req.query;

    const validation = await ShortUrl.validateSlug(slug, exclude_id);

    res.json({
      success: true,
      data: {
        slug,
        available: validation.valid,
        error: validation.error || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar preview de slug automático
 * POST /api/short-urls/generate-preview
 */
export const generateSlugPreview = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Campo title é obrigatório'
      });
    }

    const autoSlug = await ShortUrl.generateAutoSlug(title);

    res.json({
      success: true,
      data: {
        title,
        generated_slug: autoSlug,
        preview_url: `/p/${autoSlug}`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Copiar URL curta (retorna dados para clipboard)
 * GET /api/products/:id/short-urls/copy
 */
export const copyShortUrl = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { type = 'auto' } = req.query; // 'auto' ou 'custom'

    // Verificar se produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Buscar URL curta
    const isCustom = type === 'custom';
    const shortUrls = await ShortUrl.findByProductId(productId, isCustom);
    
    if (shortUrls.length === 0) {
      // Se não existe, criar automaticamente (apenas para auto)
      if (!isCustom) {
        const autoSlug = await ShortUrl.generateAutoSlug(product.title);
        const shortUrl = await ShortUrl.create(productId, autoSlug, false);
        
        return res.json({
          success: true,
          data: {
            short_url: `/p/${shortUrl.short_slug}`,
            full_url: `${req.protocol}://${req.get('host')}/p/${shortUrl.short_slug}`,
            type: 'auto',
            created_now: true
          }
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'URL curta personalizada não encontrada'
        });
      }
    }

    const shortUrl = shortUrls[0];

    res.json({
      success: true,
      data: {
        short_url: `/p/${shortUrl.short_slug}`,
        full_url: `${req.protocol}://${req.get('host')}/p/${shortUrl.short_slug}`,
        type: shortUrl.is_custom ? 'custom' : 'auto',
        created_now: false
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar URL curta para cupom de um produto
 * POST /api/products/:id/coupon-url
 */
export const createCouponUrl = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { coupon_url_slug, coupon_url } = req.body;

    // Validar dados obrigatórios
    if (!coupon_url_slug || !coupon_url) {
      return res.status(400).json({
        success: false,
        error: 'coupon_url_slug e coupon_url são obrigatórios'
      });
    }

    // Validar formato da URL
    try {
      new URL(coupon_url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'URL do cupom inválida'
      });
    }

    // Verificar se produto existe
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Verificar se slug já existe
    const existingUrl = await ShortUrl.findBySlug(coupon_url_slug);
    if (existingUrl) {
      return res.status(409).json({
        success: false,
        error: 'Slug já existe. Escolha outro encurtador.'
      });
    }

    // Criar URL curta para cupom
    const shortUrl = await ShortUrl.createCouponUrl(productId, coupon_url_slug, coupon_url);

    res.status(201).json({
      success: true,
      data: {
        id: shortUrl.id,
        short_slug: shortUrl.short_slug,
        redirect_url: shortUrl.redirect_url,
        full_short_url: `${process.env.BASE_URL || 'https://geekpromo.com.br'}/c/${shortUrl.short_slug}`,
        is_custom: shortUrl.is_custom,
        is_active: shortUrl.is_active,
        url_type: shortUrl.url_type,
        created_at: shortUrl.created_at
      },
      message: 'URL curta para cupom criada com sucesso!'
    });
  } catch (error) {
    console.error('❌ [COUPON-URL] Erro ao criar URL de cupom:', error);
    next(error);
  }
};

/**
 * Buscar URL curta por slug (para redirecionamento)
 * GET /api/short-urls/:slug
 */
export const getShortUrlBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'Slug é obrigatório'
      });
    }

    // Buscar URL curta pelo slug
    const shortUrl = await ShortUrl.findBySlug(slug);

    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL curta não encontrada'
      });
    }

    // Verificar se está ativa
    if (!shortUrl.is_active) {
      return res.status(410).json({
        success: false,
        error: 'URL curta não está mais ativa'
      });
    }

    // Retornar dados da URL curta
    res.json({
      success: true,
      data: {
        id: shortUrl.id,
        short_slug: shortUrl.short_slug,
        redirect_url: shortUrl.redirect_url,
        url_type: shortUrl.url_type,
        is_custom: shortUrl.is_custom,
        is_active: shortUrl.is_active,
        created_at: shortUrl.created_at
      }
    });
  } catch (error) {
    console.error('❌ [SHORT-URL] Erro ao buscar URL por slug:', error);
    next(error);
  }
};
