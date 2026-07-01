import Product from '../models/Product.js';
import Store from '../models/Store.js';
import Coupon from '../models/Coupon.js';

// Função para validar URL
function isValidUrl(string) {
  if (!string) return true; // URL é opcional
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Função para sanitizar e normalizar URL
function sanitizeUrl(url) {
  if (!url) return null;
  
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  // Adicionar http:// se não tiver protocolo
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  
  return trimmed;
}

// Validar dados do produto
async function validateProductData(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.title !== undefined) {
    if (!data.title || data.title.trim().length < 3) {
      errors.push('Título deve ter pelo menos 3 caracteres');
    }
  }

  if (!isUpdate || data.store_id !== undefined) {
    if (!data.store_id) {
      errors.push('ID da loja é obrigatório');
    } else {
      // Verificar se a loja existe e está ativa
      try {
        const store = await Store.findById(data.store_id);
        if (!store) {
          errors.push('Loja não encontrada');
        } else if (store.status !== 'active') {
          errors.push('Loja deve estar ativa para vincular produtos');
        }
      } catch (error) {
        errors.push('Erro ao validar loja');
      }
    }
  }

  // Validação de preços baseada no promotion_type e has_discount
  const isCoupon = data.promotion_type === 'coupon';
  const hasDiscount = data.has_discount;
  
  console.log('🔍 [VALIDATION] Tipo:', data.promotion_type, '| É cupom:', isCoupon, '| Tem desconto:', hasDiscount);
  
    if (isCoupon) {
    // Para cupons: preços são opcionais
    console.log('🎯 [VALIDATION] Validando cupom - preços são opcionais');
    
    // Se tem preços definidos, validar que sejam >= 0 (incluindo 0)
    if (data.price_before !== undefined && data.price_before !== null && data.price_before !== '') {
      const priceBefore = parseFloat(data.price_before);
      if (isNaN(priceBefore) || priceBefore < 0) {
        errors.push('Preço original deve ser positivo ou zero (se informado)');
      }
    }
    
    if (data.price_now !== undefined && data.price_now !== null && data.price_now !== '') {
      const priceNow = parseFloat(data.price_now);
      if (isNaN(priceNow) || priceNow < 0) {
        errors.push('Preço deve ser positivo ou zero (se informado)');
      }
    }
    
    // Se ambos os preços estão definidos, validar lógica
    if (data.price_before && data.price_now) {
      const priceBefore = parseFloat(data.price_before);
      const priceNow = parseFloat(data.price_now);
      if (priceNow >= priceBefore) {
        errors.push('Preço atual deve ser menor que o preço original (se ambos informados)');
      }
    }

    // ============================
    // Validações específicas de CUPOM (tabela coupons)
    // ============================

    // Tipo de desconto
    if (!data.discount_type) {
      errors.push('Tipo de desconto é obrigatório para cupons');
    } else if (!['percentage', 'fixed'].includes(data.discount_type)) {
      errors.push('Tipo de desconto inválido para cupons');
    }

    // Valor do desconto
    if (data.discount_value === undefined || data.discount_value === null || data.discount_value === '') {
      errors.push('Valor do desconto é obrigatório para cupons');
    } else {
      const discountValue = parseFloat(data.discount_value);
      if (isNaN(discountValue) || discountValue < 0) {
        errors.push('Valor do desconto deve ser um número maior ou igual a zero');
      } else if (data.discount_type === 'percentage' && discountValue > 100) {
        errors.push('Porcentagem de desconto não pode ser maior que 100%');
      } else if (data.discount_type === 'fixed' && discountValue <= 0) {
        errors.push('Valor do desconto fixo deve ser maior que zero');
      }
    }

    // URL de redirecionamento (obrigatória para cupons)
    if (!data.redirect_url || String(data.redirect_url).trim() === '') {
      errors.push('URL de redirecionamento é obrigatória para cupons');
    } else if (!isValidUrl(data.redirect_url)) {
      errors.push('URL de redirecionamento deve ser uma URL válida (http ou https)');
    }

    // Código do cupom - obrigatório se NÃO for link direto
    const isDirectLink = Boolean(data.is_direct_link);
    const couponCode = data.coupon_code || data.code;

      if (!isDirectLink) {
      if (!couponCode || String(couponCode).trim().length < 2) {
        errors.push('Código do cupom é obrigatório e deve ter pelo menos 2 caracteres quando não é link direto');
      } else if (!/^[A-Z0-9_-]+$/i.test(String(couponCode).trim())) {
        errors.push('Código do cupom deve conter apenas letras, números, hífen e underscore');
      }
      // Removida validação de unicidade aqui, pois a lógica de substituição
      // automática será tratada diretamente no modelo de Cupom (Coupon.create)
      // quando chamado com replaceIfExists=true.
    }
  } else if (hasDiscount) {
    // Produto com desconto: ambos os preços são obrigatórios
    console.log('🎯 [VALIDATION] Validando produto com desconto');
    
    if (!isUpdate || data.price_before !== undefined) {
      const priceBefore = parseFloat(data.price_before);
      if (isNaN(priceBefore) || priceBefore <= 0) {
        errors.push('Preço original deve ser um número positivo');
      }
    }

    if (!isUpdate || data.price_now !== undefined) {
      const priceNow = parseFloat(data.price_now);
      if (isNaN(priceNow) || priceNow <= 0) {
        errors.push('Preço atual deve ser um número positivo');
      }
    }

    // Validar se preço atual é menor que preço original
    if (data.price_before && data.price_now) {
      const priceBefore = parseFloat(data.price_before);
      const priceNow = parseFloat(data.price_now);
      if (priceNow >= priceBefore) {
        errors.push('Preço atual deve ser menor que o preço original');
      }
    }
  } else {
    // Produto simples: apenas price_now é obrigatório
    console.log('🎯 [VALIDATION] Validando produto simples');
    
    if (!isUpdate || data.price_now !== undefined) {
      const priceNow = parseFloat(data.price_now);
      if (isNaN(priceNow) || priceNow <= 0) {
        errors.push('Preço deve ser um número positivo');
      }
    }
  }

  // Validar partner_url se fornecida
  if (data.partner_url !== undefined && data.partner_url !== null) {
    const sanitizedUrl = sanitizeUrl(data.partner_url);
    if (sanitizedUrl && !isValidUrl(sanitizedUrl)) {
      errors.push('URL do parceiro deve ser uma URL válida (http ou https)');
    }
  }

  // Validar description se fornecida
  if (data.description !== undefined && data.description !== null && data.description !== '') {
    if (typeof data.description !== 'string') {
      errors.push('Descrição deve ser um texto');
    } else if (data.description.length > 5000) {
      errors.push('Descrição deve ter no máximo 5000 caracteres');
    }
  }

  // Validar datas
  // Data de expiração é sempre obrigatória
  if (!isUpdate || data.expires_at !== undefined) {
    if (!data.expires_at) {
      errors.push('Data de expiração é obrigatória');
    }
  }

  // Data de início é obrigatória apenas se has_custom_start_date for true
  if (data.has_custom_start_date && (!data.starts_at)) {
    errors.push('Data de início é obrigatória quando "horário personalizado" está marcado');
  }

  // Validar se data de fim é posterior à data de início (quando ambas existem)
  if (data.starts_at && data.expires_at) {
    const startDate = new Date(data.starts_at);
    const endDate = new Date(data.expires_at);
    if (endDate <= startDate) {
      errors.push('Data de expiração deve ser posterior à data de início');
    }
  }

  // Validar se a data de expiração não está no passado (apenas para criação)
  if (!isUpdate && data.expires_at) {
    const endDate = new Date(data.expires_at);
    const now = new Date();
    if (endDate <= now) {
      errors.push('Data de expiração deve ser no futuro');
    }
  }

  // Validar category_ids se fornecidas
  if (data.category_ids !== undefined) {
    if (!Array.isArray(data.category_ids)) {
      errors.push('category_ids deve ser um array');
    } else if (data.category_ids.length > 10) {
      errors.push('Máximo de 10 categorias por produto');
    } else {
      // Validar se todos os IDs são strings válidas
      const invalidIds = data.category_ids.filter(id => !id || typeof id !== 'string' || id.trim().length === 0);
      if (invalidIds.length > 0) {
        errors.push('Todos os IDs de categoria devem ser strings válidas');
      }
    }
  }

  // Validar campos de cartão de crédito
  if (data.has_credit_card !== undefined) {
    if (typeof data.has_credit_card !== 'boolean') {
      errors.push('has_credit_card deve ser um boolean');
    } else if (data.has_credit_card) {
      // Se aceita cartão, validar campos obrigatórios
      if (!data.credit_card_price || data.credit_card_price <= 0) {
        errors.push('Preço no cartão de crédito é obrigatório quando aceita cartão');
      }
      if (!data.max_installments || data.max_installments <= 0 || data.max_installments > 24) {
        errors.push('Quantidade máxima de parcelas deve ser entre 1 e 24 quando aceita cartão');
      }
    }
  }

  return errors;
}

// Listar produtos
export const listProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      store_id,
      status,
      search,
      category_id,
      category_ids,
      include_categories = 'false',
      include_store = 'false',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Processar category_ids se fornecido como string
    let categoryIdsArray = null;
    if (category_ids) {
      categoryIdsArray = category_ids.split(',').map(id => id.trim()).filter(id => id);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      store_id,
      status,
      search,
      category_id,
      category_ids: categoryIdsArray,
      include_categories: include_categories === 'true',
      include_store: include_store === 'true',
      sort_by,
      sort_order
    };

    const result = await Product.findAll(options);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// Obter produto por ID
export const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { include_store = 'false' } = req.query;
    
    const product = await Product.findById(id, true, include_store === 'true');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// Criar produto
export const createProduct = async (req, res, next) => {
  try {
    console.log('🚀 [CREATE PRODUCT] Iniciando criação de produto');
    console.log('📊 [CREATE PRODUCT] Dados recebidos:', JSON.stringify(req.body, null, 2));
    
    const errors = await validateProductData(req.body);
    if (errors.length > 0) {
      console.log('❌ [CREATE PRODUCT] Erros de validação:', errors);
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    console.log('✅ [CREATE PRODUCT] Validação passou, criando produto...');

    // Sanitizar partner_url
    const productData = { ...req.body };
    if (productData.partner_url) {
      productData.partner_url = sanitizeUrl(productData.partner_url);
      console.log('🔗 [CREATE PRODUCT] URL sanitizada:', productData.partner_url);
    }

    console.log('📝 [CREATE PRODUCT] Dados finais para criação:', JSON.stringify(productData, null, 2));
    const product = await Product.create(productData);
    console.log('✅ [CREATE PRODUCT] Produto criado com sucesso:', product.id);

    // Criar cupom vinculado quando for promoção do tipo CUPOM
    if (product.promotion_type === 'coupon') {
      try {
        console.log('🎫 [CREATE PRODUCT] Criando cupom vinculado à promoção:', product.id);
        await Coupon.createFromPromotion(product, productData);
        console.log('✅ [CREATE PRODUCT] Cupom vinculado criado com sucesso para promoção:', product.id);
      } catch (couponError) {
        console.error('❌ [CREATE PRODUCT] Erro ao criar cupom vinculado à promoção:', couponError);
        // Não falhar a criação do produto por causa do cupom; apenas logar
      }
    }

    // Criar jobs dinâmicos para a promoção
    try {
      const { default: scheduler } = await import('../scheduler.js');
      
      // Job de publicação (se tem data de início)
      if (productData.starts_at) {
        scheduler.schedulePromotionJob(product.id, productData.starts_at, 'publish');
      }
      
      // Job de expiração (sempre tem data de fim)
      if (productData.expires_at) {
        scheduler.schedulePromotionJob(product.id, productData.expires_at, 'expire');
      }
      
      console.log(`📅 [CREATE] Jobs dinâmicos criados para promoção ${product.id}`);
    } catch (schedulerError) {
      console.error('❌ Erro ao criar jobs dinâmicos:', schedulerError);
      // Não falhar a criação do produto por causa do scheduler
    }

    res.status(201).json({
      success: true,
      data: product,
      message: 'Produto criado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// Atualizar produto
export const updateProduct = async (req, res, next) => {
  try {
    
    const { id } = req.params;

    // Verificar se produto existe
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    // Se o produto já é um CUPOM, não permitir voltar para PRODUCT
    if (existingProduct.promotion_type === 'coupon') {
      if (req.body.promotion_type && req.body.promotion_type !== 'coupon') {
        console.log('⚠️ [UPDATE PRODUCT] Tentativa de alterar promotion_type de cupom para produto ignorada');
      }
      req.body.promotion_type = 'coupon';
    }

    const errors = await validateProductData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    // Sanitizar partner_url
    const updateData = { ...req.body };
    if (updateData.partner_url !== undefined) {
      updateData.partner_url = sanitizeUrl(updateData.partner_url);
    }

    const product = await Product.update(id, updateData);

    // Atualizar (ou criar) cupom vinculado quando for promoção do tipo CUPOM
    if (product.promotion_type === 'coupon') {
      try {
        console.log('🎫 [UPDATE PRODUCT] Atualizando/criando cupom vinculado à promoção:', id);
        await Coupon.updateFromPromotion(product, updateData);
        console.log('✅ [UPDATE PRODUCT] Cupom vinculado atualizado/criado com sucesso para promoção:', id);
      } catch (couponError) {
        console.error('❌ [UPDATE PRODUCT] Erro ao atualizar cupom vinculado à promoção:', couponError);
        // Não falhar a atualização do produto por causa do cupom; apenas logar
      }
    }

    // Atualizar jobs dinâmicos para a promoção
    try {
      const { default: scheduler } = await import('../scheduler.js');
      
      // Cancelar jobs existentes
      scheduler.cancelPromotionJob(id, 'publish');
      scheduler.cancelPromotionJob(id, 'expire');
      
      // Criar novos jobs baseados nos dados atualizados
      // Job de publicação (se tem data de início)
      if (updateData.starts_at || (existingProduct.starts_at && updateData.starts_at !== null)) {
        const startDate = updateData.starts_at || existingProduct.starts_at;
        if (startDate) {
          scheduler.schedulePromotionJob(id, startDate, 'publish');
        }
      }
      
      // Job de expiração (sempre tem data de fim)
      const expireDate = updateData.expires_at || existingProduct.expires_at;
      if (expireDate) {
        scheduler.schedulePromotionJob(id, expireDate, 'expire');
      }
      
      console.log(`📅 [UPDATE] Jobs dinâmicos atualizados para promoção ${id}`);
    } catch (schedulerError) {
      console.error('❌ Erro ao atualizar jobs dinâmicos:', schedulerError);
      // Não falhar a atualização do produto por causa do scheduler
    }

    res.json({
      success: true,
      data: product,
      message: 'Produto atualizado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// Deletar produto
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await Product.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Produto removido com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// Redirecionar para link do parceiro
export const redirectToPartner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    if (!product.partner_url) {
      return res.status(404).json({
        success: false,
        error: 'Link do parceiro não configurado para este produto'
      });
    }

    // Log de auditoria
    console.log(`Redirecionamento: produto ${id} para ${product.partner_url} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);

    // TODO: Opcional - incrementar click_count ou registrar em analytics
    // await query('UPDATE promotions SET clicks_count = clicks_count + 1 WHERE id = ?', [id]);

    // Redirecionamento 302
    res.redirect(302, product.partner_url);

  } catch (error) {
    next(error);
  }
};

// ========== CONTROLLERS DE CATEGORIA ==========

// Obter categorias de um produto
export const getProductCategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id, false);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }

    const categories = await Product.getCategories(id);
    
    res.json({
      success: true,
      data: categories,
      message: `${categories.length} categoria(s) encontrada(s)`
    });
  } catch (error) {
    next(error);
  }
};

// Definir categorias de um produto (substitui todas)
export const setProductCategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_ids = [] } = req.body;

    // Validar category_ids
    if (!Array.isArray(category_ids)) {
      return res.status(400).json({
        success: false,
        error: 'category_ids deve ser um array'
      });
    }

    if (category_ids.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo de 10 categorias por produto'
      });
    }

    const categories = await Product.setCategories(id, category_ids);
    
    res.json({
      success: true,
      data: categories,
      message: `Categorias do produto atualizadas com sucesso`
    });
  } catch (error) {
    if (error.message.includes('não encontrado') || error.message.includes('inválidas')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// Adicionar categorias a um produto (merge)
export const addProductCategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_ids = [] } = req.body;

    // Validar category_ids
    if (!Array.isArray(category_ids)) {
      return res.status(400).json({
        success: false,
        error: 'category_ids deve ser um array'
      });
    }

    const categories = await Product.addCategories(id, category_ids);
    
    res.json({
      success: true,
      data: categories,
      message: `Categorias adicionadas ao produto com sucesso`
    });
  } catch (error) {
    if (error.message.includes('não encontrado') || error.message.includes('inválidas')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// Remover categoria específica de um produto
export const removeProductCategory = async (req, res, next) => {
  try {
    const { id, categoryId } = req.params;
    
    const removed = await Product.removeCategory(id, categoryId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Produto ou categoria não encontrada, ou vínculo não existe'
      });
    }
    
    res.json({
      success: true,
      message: 'Categoria removida do produto com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// Obter estatísticas dos produtos
export const getProductStats = async (req, res, next) => {
  try {
    const stats = await Product.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}; 

// Obter produto publicado por slug (público)
export const getPublicProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { include_store = 'true', include_categories = 'true' } = req.query;

    const product = await Product.findBySlug(
      slug,
      include_categories === 'true',
      include_store === 'true'
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado ou não publicado'
      });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Incrementar visualização por slug (público)
export const incrementPublicProductView = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Bloqueio simples para bots conhecidos
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const isBot = /(bot|crawler|spider|crawling)/.test(ua);
    if (isBot) {
      return res.json({ success: true, message: 'Ignorado (bot)' });
    }

    const updated = await Product.incrementViewBySlug(slug);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado ou não publicado' });
    }
    return res.json({ success: true, message: 'View contabilizada' });
  } catch (error) {
    next(error);
  }
};

// Incrementar clique em link alternativo (público)
export const incrementAlternativeLinkClick = async (req, res, next) => {
  try {
    const { linkId } = req.params;

    // Bloqueio simples para bots conhecidos
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const isBot = /(bot|crawler|spider|crawling)/.test(ua);
    if (isBot) {
      return res.json({ success: true, message: 'Ignorado (bot)' });
    }

    const updated = await Product.incrementAlternativeLinkClick(linkId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Link não encontrado' });
    }
    return res.json({ success: true, message: 'Clique contabilizado' });
  } catch (error) {
    next(error);
  }
};

// Buscar produtos relacionados (público)
export const getRelatedProducts = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { limit = 4 } = req.query;
    
    // Buscar o produto atual
    const currentProduct = await Product.findBySlug(slug, true, true);
    if (!currentProduct) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado' });
    }
    
    let relatedProducts = [];
    
    // 1º: Buscar produtos da mesma categoria
    if (currentProduct.categories && currentProduct.categories.length > 0) {
      const categoryId = currentProduct.categories[0].id;
      const categoryProducts = await Product.findByCategory(categoryId, {
        limit: parseInt(limit),
        excludeId: currentProduct.id,
        include_store: true,
        include_categories: true
      });
      
      if (categoryProducts.length > 0) {
        relatedProducts = categoryProducts;
      }
    }
    
    // 2º: Se não encontrou por categoria, buscar produtos da mesma loja
    if (relatedProducts.length === 0) {
      const storeProducts = await Product.findAll({
        store_id: currentProduct.store_id,
        status: 'published',
        limit: parseInt(limit),
        exclude_id: currentProduct.id,
        include_store: true,
        include_categories: true
      });
      
      if (storeProducts.data && storeProducts.data.length > 0) {
        relatedProducts = storeProducts.data;
      }
    }
    
    // 3º: Se ainda não encontrou, buscar últimos publicados
    if (relatedProducts.length === 0) {
      const recentProducts = await Product.findAll({
        status: 'published',
        limit: parseInt(limit),
        exclude_id: currentProduct.id,
        include_store: true,
        include_categories: true,
        sort_by: 'created_at',
        sort_order: 'DESC'
      });
      
      if (recentProducts.data && recentProducts.data.length > 0) {
        relatedProducts = recentProducts.data;
      }
    }
    
    res.json({ 
      success: true, 
      data: relatedProducts,
      strategy: relatedProducts.length > 0 ? 
        (relatedProducts[0].categories && relatedProducts[0].categories.length > 0 ? 'category' : 
         relatedProducts[0].store_id === currentProduct.store_id ? 'store' : 'recent') : 'none'
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// NOVOS ENDPOINTS PARA SISTEMA DE DATAS
// ========================================

// Publicar promoções agendadas manualmente
export const publishScheduledPromotions = async (req, res, next) => {
  try {
    const publishedCount = await Product.publishScheduledPromotions();
    
    res.json({
      success: true,
      message: `${publishedCount} promoções foram publicadas`,
      published_count: publishedCount
    });
  } catch (error) {
    console.error('❌ Erro ao publicar promoções agendadas:', error);
    next(error);
  }
};

// Expirar promoções manualmente
export const expirePromotions = async (req, res, next) => {
  try {
    const expiredCount = await Product.expirePromotions();
    
    res.json({
      success: true,
      message: `${expiredCount} promoções foram expiradas`,
      expired_count: expiredCount
    });
  } catch (error) {
    console.error('❌ Erro ao expirar promoções:', error);
    next(error);
  }
};

// Listar promoções agendadas (admin)
export const listScheduledPromotions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await Product.findScheduledPromotions({
      page: parseInt(page),
      limit: parseInt(limit),
      include_categories: true,
      include_store: true
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

// Executar automação completa (publicar + expirar)
export const runAutomation = async (req, res, next) => {
  try {
    const [publishedCount, expiredCount] = await Promise.all([
      Product.publishScheduledPromotions(),
      Product.expirePromotions()
    ]);
    
    res.json({
      success: true,
      message: `Automação executada: ${publishedCount} publicadas, ${expiredCount} expiradas`,
      published_count: publishedCount,
      expired_count: expiredCount
    });
  } catch (error) {
    console.error('❌ Erro na automação:', error);
    next(error);
  }
};

// Buscar promoções por categoria (público)
export const getPromotionsByCategory = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20 } = req.query;

    console.log('🔍 Buscando promoções para categoria:', slug);

    // Buscar categoria por slug
    const Category = (await import('../models/Category.js')).default;
    const category = await Category.findBySlug(slug);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      });
    }

    if (category.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Categoria não está ativa'
      });
    }

    console.log('✅ Categoria encontrada:', category.name);

    // Buscar promoções da categoria
    const result = await Product.findByCategory(category.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      include_store: true,
      include_categories: true
    });

    console.log(`📊 Encontradas ${result.data.length} promoções para categoria ${category.name}`);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image_url: category.image_url
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar promoções por categoria:', error);
    next(error);
  }
};

// Buscar produtos por termo (público)
export const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 20, sort = 'relevance' } = req.query;

    console.log('🔍 Buscando produtos com termo:', q);

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Termo de busca é obrigatório'
      });
    }

    const searchTerm = q.trim();
    
    // Buscar produtos que correspondem ao termo
    const result = await Product.searchProducts(searchTerm, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      include_store: true,
      include_categories: true
    });

    console.log(`📊 Encontrados ${result.data.length} produtos para termo "${searchTerm}"`);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      query: searchTerm,
      filters_applied: {
        sort
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    next(error);
  }
};

// Buscar promoções do dia (público)
export const getDailyPromotions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    console.log('📅 Buscando promoções do dia');

    // Buscar produtos ativos do dia
    const result = await Product.findActivePromotions({
      page: parseInt(page),
      limit: parseInt(limit),
      include_store: true,
      include_categories: true,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });

    console.log(`📊 Encontradas ${result.data.length} promoções do dia`);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      date: new Date().toISOString().split('T')[0] // Data atual no formato YYYY-MM-DD
    });

  } catch (error) {
    console.error('❌ Erro ao buscar promoções do dia:', error);
    next(error);
  }
};

// Buscar produtos mais vistos (público)
export const getMostViewedProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 6 } = req.query;

    console.log('👀 Buscando produtos mais vistos');

    // Buscar produtos ativos ordenados por visualizações
    const result = await Product.findActivePromotions({
      page: parseInt(page),
      limit: parseInt(limit),
      include_store: true,
      include_categories: true,
      sort_by: 'views_count',
      sort_order: 'DESC'
    });

    console.log(`📊 Encontrados ${result.data.length} produtos mais vistos`);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('❌ Erro ao buscar produtos mais vistos:', error);
    next(error);
  }
};