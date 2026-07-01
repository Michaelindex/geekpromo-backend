import Coupon from '../models/Coupon.js';
import Store from '../models/Store.js';

// Validar dados do cupom (versão básica)
function validateCouponData(data, isUpdate = false) {
  const errors = [];

  // Título
  if (!isUpdate || data.title !== undefined) {
    if (!data.title || data.title.trim().length < 3) {
      errors.push('Título deve ter pelo menos 3 caracteres');
    }
  }

  // Código - agora é opcional (pode ser null para link direto)
  if (!isUpdate || data.code !== undefined) {
    // Se código for fornecido, validar
    if (data.code !== null && data.code !== undefined && data.code !== '') {
      if (data.code.trim().length < 2) {
        errors.push('Código deve ter pelo menos 2 caracteres');
      } else if (!/^[A-Z0-9_-]+$/i.test(data.code.trim())) {
        errors.push('Código deve conter apenas letras, números, hífen e underscore');
      }
    }
    // Se código for null ou vazio, é permitido (link direto)
  }

  // Store ID
  if (!isUpdate || data.store_id !== undefined) {
    if (!data.store_id) {
      errors.push('ID da loja é obrigatório');
    }
  }

  // Data de expiração
  if (!isUpdate || data.expires_at !== undefined) {
    if (!data.expires_at) {
      errors.push('Data de expiração é obrigatória');
    } else {
      // Permitir datas passadas (como nas promoções)
      const expiresAt = new Date(data.expires_at);
      if (isNaN(expiresAt.getTime())) {
        errors.push('Data de expiração deve ser uma data válida');
      }
    }
  }

  // Validar status
  if (data.status !== undefined) {
    if (!['draft', 'active', 'expired'].includes(data.status)) {
      errors.push('Status deve ser "draft", "active" ou "expired"');
    }
  }

  // Validar redirect_url (obrigatório)
  if (!isUpdate || data.redirect_url !== undefined) {
    if (!data.redirect_url || data.redirect_url.trim() === '') {
      errors.push('Link de redirecionamento é obrigatório');
    } else {
      try {
        new URL(data.redirect_url);
      } catch {
        errors.push('URL de redirecionamento deve ser uma URL válida');
      }
    }
  }

  return errors;
}

// Listar cupons
export const listCoupons = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      sort_by,
      sort_order
    };

    const result = await Coupon.findAll(options);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// Obter cupom por ID
export const getCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado'
      });
    }

    res.json({
      success: true,
      data: coupon
    });
  } catch (error) {
    next(error);
  }
};

// Obter cupom vinculado a uma promoção (por promotion_id)
export const getCouponByPromotionId = async (req, res, next) => {
  try {
    const { promotionId } = req.params;

    console.log('[COUPON][BY-PROMOTION] Buscando cupom para promoção:', promotionId);

    const coupon = await Coupon.findByPromotionId(promotionId);

    if (!coupon) {
      console.log('[COUPON][BY-PROMOTION] Nenhum cupom encontrado para promoção:', promotionId);
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado para esta promoção'
      });
    }

    console.log('[COUPON][BY-PROMOTION] Cupom encontrado para promoção:', promotionId, '→', coupon.id);

    res.json({
      success: true,
      data: coupon
    });
  } catch (error) {
    console.error('[COUPON][BY-PROMOTION] Erro ao buscar cupom por promotion_id:', error);
    next(error);
  }
};

// Criar cupom
export const createCoupon = async (req, res, next) => {
  try {
    const errors = validateCouponData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    // Aqui usamos replaceIfExists=true para que, se já existir um cupom
    // com mesmo código + loja, o antigo seja apagado e o novo criado.
    const coupon = await Coupon.create(req.body, { replaceIfExists: true });

    res.status(201).json({
      success: true,
      data: coupon,
      message: 'Cupom criado com sucesso'
    });
  } catch (error) {
    if (error.message.includes('já existe')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// Atualizar cupom
export const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar se cupom existe
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado'
      });
    }

    const errors = validateCouponData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    const coupon = await Coupon.update(id, req.body);

    res.json({
      success: true,
      data: coupon,
      message: 'Cupom atualizado com sucesso'
    });
  } catch (error) {
    if (error.message.includes('já existe')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// Deletar cupom
export const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Coupon.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Cupom removido com sucesso'
    });
  } catch (error) {
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// Buscar cupons para select
export const getCouponsForSelect = async (req, res, next) => {
  try {
    const coupons = await Coupon.findForSelect();

    res.json({
      success: true,
      data: coupons
    });
  } catch (error) {
    next(error);
  }
};

// Obter estatísticas
export const getCouponStats = async (req, res, next) => {
  try {
    const stats = await Coupon.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Listar cupons públicos (ativos e não expirados)
export const listPublicCoupons = async (req, res, next) => {
  try {
    const {
      featured,
      discount_type,
      limit = 20,
      sort = 'recent'
    } = req.query;

    console.log('Parâmetros recebidos:', { featured, discount_type, limit, sort });

    // Construir filtros
    const filters = {
      status: 'active',
      limit: parseInt(limit)
    };

    // Filtro por destaque
    if (featured !== undefined) {
      filters.featured = featured === 'true';
    }

    // Filtro por tipo de desconto
    if (discount_type && discount_type !== 'all') {
      filters.discount_type = discount_type;
    }

    // Ordenação
    if (sort === 'featured') {
      filters.sort_by = 'featured';
      filters.sort_order = 'DESC';
    } else {
      filters.sort_by = 'created_at';
      filters.sort_order = 'DESC';
    }

    console.log('Filtros aplicados:', filters);

    // Buscar cupons
    const coupons = await Coupon.findAll(filters);

    // Adicionar dados da loja para cada cupom
    const couponsWithStore = await Promise.all(
      coupons.data.map(async (coupon) => {
        const store = await Store.findById(coupon.store_id);
        return {
          ...coupon,
          store: store ? {
            id: store.id,
            name: store.name,
            slug: store.slug,
            logo_url: store.logo_url,
            affiliate_base_url: store.affiliate_base_url,
            default_params: store.default_params,
            status: store.status
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: couponsWithStore,
      pagination: coupons.pagination
    });
  } catch (error) {
    console.error('Erro ao buscar cupons públicos:', error);
    next(error);
  }
};

// Sistema de tracking sem rate limiting

// Tracking de clique em cupom
export const trackCouponClick = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    console.log(`📊 [COUPON TRACKING] Click no cupom ${id} do IP ${clientIP}`);

    // Verificar se cupom existe
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Cupom não encontrado'
      });
    }

    // Verificar se cupom está ativo
    if (coupon.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cupom não está ativo'
      });
    }

    // Verificar se cupom não expirou
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Cupom expirado'
      });
    }

    // Tracking sem rate limiting - permitir cliques ilimitados

    // Incrementar contador de uso
    await Coupon.incrementUsage(id);

    console.log(`✅ [COUPON TRACKING] Click registrado para cupom ${id} do IP ${clientIP}`);

    res.json({
      success: true,
      message: 'Click registrado com sucesso',
      data: {
        coupon_id: id,
        coupon_code: coupon.code,
        usage_count: coupon.usage_count + 1
      }
    });

  } catch (error) {
    console.error('❌ [COUPON TRACKING] Erro ao registrar click:', error);
    next(error);
  }
}; 