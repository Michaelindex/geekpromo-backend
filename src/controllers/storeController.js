import Store from '../models/Store.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

// Validar dados da loja
const validateStoreData = (data, isUpdate = false) => {
  const errors = [];

  // Nome (obrigatório para criação, opcional para atualização)
  if (!isUpdate && (!data.name || typeof data.name !== 'string')) {
    errors.push('Nome da loja é obrigatório');
  } else if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 2) {
      errors.push('Nome da loja deve ter pelo menos 2 caracteres');
    } else if (data.name.trim().length > 255) {
      errors.push('Nome da loja não pode ter mais de 255 caracteres');
    }
  }

  // Slug (opcional, mas se fornecido deve ser válido)
  if (data.slug !== undefined) {
    if (typeof data.slug !== 'string') {
      errors.push('Slug deve ser uma string');
    } else if (data.slug.length > 255) {
      errors.push('Slug não pode ter mais de 255 caracteres');
    }
  }

  // URL do logo (opcional, mas se fornecida deve ser válida)
  if (data.logo_url !== undefined && data.logo_url !== '') {
    if (typeof data.logo_url !== 'string') {
      errors.push('URL do logo deve ser uma string');
    } else {
      try {
        new URL(data.logo_url);
      } catch {
        errors.push('URL do logo deve ser uma URL válida');
      }
    }
  }

  // URL base de afiliado (obrigatória para criação)
  if (!isUpdate && (!data.affiliate_base_url || typeof data.affiliate_base_url !== 'string')) {
    errors.push('URL base de afiliado é obrigatória');
  } else if (data.affiliate_base_url !== undefined) {
    if (typeof data.affiliate_base_url !== 'string' || data.affiliate_base_url.trim().length === 0) {
      errors.push('URL base de afiliado é obrigatória');
    } else {
      try {
        new URL(data.affiliate_base_url);
      } catch {
        errors.push('URL base de afiliado deve ser uma URL válida');
      }
    }
  }

  // Parâmetros padrão (opcional)
  if (data.default_params !== undefined && typeof data.default_params !== 'string') {
    errors.push('Parâmetros padrão devem ser uma string');
  }

  // Status (opcional, mas se fornecido deve ser válido)
  if (data.status !== undefined) {
    if (!['active', 'inactive'].includes(data.status)) {
      errors.push('Status deve ser "active" ou "inactive"');
    }
  }

  // Validar sort_order (opcional)
  if (data.sort_order !== undefined) {
    const sortOrder = parseInt(data.sort_order);
    if (isNaN(sortOrder) || sortOrder < 0) {
      errors.push('Ordem deve ser um número maior ou igual a 0');
    }
  }

  // Validar use_custom_order (opcional)
  if (data.use_custom_order !== undefined) {
    if (typeof data.use_custom_order !== 'boolean') {
      errors.push('Usar ordem personalizada deve ser verdadeiro ou falso');
    }
  }

  // Validar relação entre use_custom_order e sort_order
  if (data.use_custom_order === true && (data.sort_order === undefined || parseInt(data.sort_order) < 1)) {
    errors.push('Quando usar ordem personalizada, a posição deve ser maior que 0');
  }

  return errors;
};

// Listar lojas
export const listStores = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'name_asc'
    } = req.query;

    // Validar parâmetros
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Página deve ser um número maior que 0'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limite deve ser um número entre 1 e 100'
      });
    }

    const validSorts = ['sort_order_asc', 'sort_order_desc', 'name_asc', 'name_desc', 'created_asc', 'created_desc', 'updated_desc'];
    if (sort && !validSorts.includes(sort)) {
      return res.status(400).json({
        success: false,
        error: 'Ordenação inválida'
      });
    }

    const result = await Store.findAll({
      page: pageNum,
      limit: limitNum,
      search: search.toString(),
      status: status.toString(),
      sort: sort.toString()
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    next(error);
  }
};

// Obter loja por ID
export const getStore = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da loja é obrigatório'
      });
    }

    const store = await Store.findById(id);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Loja não encontrada'
      });
    }

    res.json({
      success: true,
      data: store
    });

  } catch (error) {
    console.error('Erro ao buscar loja:', error);
    next(error);
  }
};

// Criar nova loja
export const createStore = async (req, res, next) => {
  try {
    const storeData = req.body;

    // Validar dados
    const validationErrors = validateStoreData(storeData, false);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validationErrors
      });
    }

    const newStore = await Store.create(storeData);

    res.status(201).json({
      success: true,
      data: newStore,
      message: 'Loja criada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar loja:', error);
    
    if (error.message.includes('Já existe') || error.message.includes('obrigatório') || error.message.includes('válida') || error.message.includes('posição')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

// Atualizar loja
export const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const storeData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da loja é obrigatório'
      });
    }

    // Validar dados
    const validationErrors = validateStoreData(storeData, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validationErrors
      });
    }

    const updatedStore = await Store.update(id, storeData);

    res.json({
      success: true,
      data: updatedStore,
      message: 'Loja atualizada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar loja:', error);
    
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('Já existe') || error.message.includes('obrigatório') || error.message.includes('válida') || error.message.includes('posição')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

// Deletar loja
export const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da loja é obrigatório'
      });
    }

    const result = await Store.delete(id);

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Erro ao deletar loja:', error);
    
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('não é possível deletar')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

// Obter lojas para select
export const getStoresForSelect = async (req, res, next) => {
  try {
    const stores = await Store.findForSelect();

    res.json({
      success: true,
      data: stores
    });

  } catch (error) {
    console.error('Erro ao buscar lojas para select:', error);
    next(error);
  }
};

// Obter estatísticas das lojas
export const getStoreStats = async (req, res, next) => {
  try {
    const stats = await Store.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas das lojas:', error);
    next(error);
  }
}; 

// ========== PÚBLICO ==========

// GET /api/stores/public - listar todas as lojas ativas
export const listPublicStores = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      sort = 'sort_order_asc'
    } = req.query;

    // Validar parâmetros
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Máximo 100 por página

    // Construir filtros para lojas ativas
    const filters = {
      status: 'active',
      search: search.trim(),
      sort
    };

    const result = await Store.findAll({
      page: pageNum,
      limit: limitNum,
      ...filters
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erro ao listar lojas públicas:', error);
    next(error);
  }
};

// GET /api/stores/public/:slug - obter loja ativa por slug
export const getPublicStoreBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const store = await Store.findBySlug(slug);
    if (!store || store.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Loja não encontrada ou inativa' });
    }
    return res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
};

// GET /api/stores/public/:slug/products - listar promoções publicadas da loja
export const listPublicStoreProducts = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC' } = req.query;

    const store = await Store.findBySlug(slug);
    if (!store || store.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Loja não encontrada ou inativa' });
    }

    const result = await Product.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      store_id: store.id,
      status: 'published',
      include_categories: true,
      include_store: true,
      sort_by,
      sort_order
    });

    return res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

// GET /api/stores/public/:slug/coupons - listar cupons ativos da loja
export const listPublicStoreCoupons = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC' } = req.query;

    const store = await Store.findBySlug(slug);
    if (!store || store.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Loja não encontrada ou inativa' });
    }

    const result = await Coupon.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      store_id: store.id,
      status: 'active',
      sort_by,
      sort_order
    });

    return res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

// GET /api/stores/public/:slug/counters - counters rápidos
export const getPublicStoreCounters = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const store = await Store.findBySlug(slug);
    if (!store || store.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Loja não encontrada ou inativa' });
    }
    const [promotionsCountResult, couponsCountResult] = await Promise.all([
      Product.findAll({ page: 1, limit: 1, store_id: store.id, status: 'published' }),
      Coupon.findAll({ page: 1, limit: 1, store_id: store.id, status: 'active' })
    ]);

    // As funções findAll já retornam paginação com total
    const promotionsCount = promotionsCountResult.pagination.total;
    const couponsCount = couponsCountResult.pagination.total;

    return res.json({ success: true, data: { promotions: promotionsCount, coupons: couponsCount } });
  } catch (error) {
    next(error);
  }
};

// Cache em memória para rate limiting de lojas (2 minutos)
const storeClickCache = new Map();

// Limpar cache antigo a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of storeClickCache.entries()) {
    if (now - timestamp > 5 * 60 * 1000) { // 5 minutos
      storeClickCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// POST /api/stores/:id/track-click - Tracking de clique em loja
export const trackStoreClick = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    console.log(`📊 [STORE TRACKING] Click na loja ${id} do IP ${clientIP}`);

    // Verificar se loja existe
    const store = await Store.findById(id);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Loja não encontrada'
      });
    }

    // Verificar se loja está ativa
    if (store.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Loja não está ativa'
      });
    }

    // RATE LIMITING: Verificar se IP já clicou nesta loja nos últimos 2 minutos
    const cacheKey = `${clientIP}_store_${id}`;
    const lastClick = storeClickCache.get(cacheKey);
    const now = Date.now();
    
    if (lastClick && (now - lastClick) < 120000) { // 2 minutos = 120 segundos
      const remainingTime = Math.ceil((120000 - (now - lastClick)) / 1000);
      console.log(`🚫 [STORE RATE LIMIT] IP ${clientIP} tentou spam na loja ${id}. Aguarde ${remainingTime}s`);
      
      return res.status(429).json({
        success: false,
        error: `Aguarde ${remainingTime} segundos antes de clicar novamente nesta loja`,
        retry_after: remainingTime
      });
    }

    // Registrar click no cache
    storeClickCache.set(cacheKey, now);

    // Incrementar contador de cliques
    await Store.incrementClicks(id);

    console.log(`✅ [STORE TRACKING] Click registrado para loja ${id} do IP ${clientIP}`);

    res.json({
      success: true,
      message: 'Click na loja registrado com sucesso',
      data: {
        store_id: id,
        store_name: store.name,
        clicks_count: store.clicks_count + 1
      }
    });

  } catch (error) {
    console.error('❌ [STORE TRACKING] Erro ao registrar click na loja:', error);
    next(error);
  }
};