import { query } from '../config/database.js';
import ShortUrl from './ShortUrl.js';

// Função auxiliar para formatar data para MySQL
function formatDateForMySQL(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

class Product {
  // Buscar todos os produtos com paginação e filtros
  static async findAll(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      store_id, 
      status, 
      search,
      category_id,
      category_ids,
      exclude_id,
      include_categories = false,
      include_store = false,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = [];
    let params = [];

    if (store_id) {
      whereConditions.push('p.store_id = ?');
      params.push(store_id);
    }

    if (status) {
      whereConditions.push('p.status = ?');
      params.push(status);
    }

    if (exclude_id) {
      whereConditions.push('p.id != ?');
      params.push(exclude_id);
    }

    if (search) {
      whereConditions.push('(p.title LIKE ? OR p.slug LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filtro por categoria única
    if (category_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM promotion_categories pc WHERE pc.promotion_id = p.id AND pc.category_id = ?)');
      params.push(category_id);
    }

    // Filtro por múltiplas categorias (qualquer uma)
    if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
      const placeholders = category_ids.map(() => '?').join(',');
      whereConditions.push(`EXISTS (SELECT 1 FROM promotion_categories pc WHERE pc.promotion_id = p.id AND pc.category_id IN (${placeholders}))`);
      params.push(...category_ids);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Campos da loja se include_store for true
    const storeFields = include_store ? `
        s.name as store_name,
        s.slug as store_slug,
        s.logo_url as store_logo_url,
        s.affiliate_base_url as store_affiliate_base_url,
        s.default_params as store_default_params,
        s.status as store_status` : `
        s.name as store_name`;

    const sql = `
      SELECT 
        p.id,
        p.store_id,
        p.title,
        p.slug,
        p.image_url,
        p.partner_url,
        p.description,
        p.price_before,
        p.price_now,
        p.has_discount,
        p.discount_pct,
        p.has_coupon,
        p.coupon_code,
        p.has_credit_card,
        p.credit_card_price,
        p.max_installments,
        p.has_coupon_url,
        p.coupon_url_slug,
        p.coupon_url,
        p.starts_at,
        p.expires_at,
        p.status,
        p.promotion_type,
        p.views_count,
        p.clicks_count,
        p.created_at,
        p.updated_at,
        ${storeFields}
      FROM promotions p
      LEFT JOIN stores s ON p.store_id = s.id
      ${whereClause}
      ORDER BY p.${sort_by} ${sort_order}
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM promotions p
      ${whereClause}
    `;

    const [products, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params)
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    // Incluir categorias se solicitado
    if (include_categories && products.length > 0) {
      for (const product of products) {
        product.categories = await this.getCategories(product.id);
      }
    }

    return {
      data: products,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1
      }
    };
  }

  // Buscar produto por ID
  static async findById(id, includeCategories = true, includeStore = false) {
    // Campos da loja se includeStore for true
    const storeFields = includeStore ? `
        s.name as store_name,
        s.slug as store_slug,
        s.logo_url as store_logo_url,
        s.affiliate_base_url as store_affiliate_base_url,
        s.default_params as store_default_params,
        s.status as store_status` : `
        s.name as store_name`;

    const sql = `
      SELECT 
        p.id,
        p.store_id,
        p.title,
        p.slug,
        p.image_url,
        p.partner_url,
        p.description,
        p.price_before,
        p.price_now,
        p.has_discount,
        p.discount_pct,
        p.has_coupon,
        p.coupon_code,
        p.has_credit_card,
        p.credit_card_price,
        p.max_installments,
        p.has_coupon_url,
        p.coupon_url_slug,
        p.coupon_url,
        p.starts_at,
        p.expires_at,
        p.status,
        p.promotion_type,
        p.views_count,
        p.clicks_count,
        p.created_at,
        p.updated_at,
        ${storeFields}
      FROM promotions p
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.id = ?
    `;
    
    const results = await query(sql, [id]);
    const product = results[0] || null;
    
    if (product && includeCategories) {
      product.categories = await this.getCategories(id);
    }
    
    if (product) {
      product.alternative_links = await this.getAlternativeLinks(id);
    }

    return product;
  }

  // Buscar produto PUBLICADO por slug
  static async findBySlug(slug, includeCategories = true, includeStore = false) {
    const storeFields = includeStore ? `
        s.name as store_name,
        s.slug as store_slug,
        s.logo_url as store_logo_url,
        s.affiliate_base_url as store_affiliate_base_url,
        s.default_params as store_default_params,
        s.status as store_status` : `
        s.name as store_name`;

    const sql = `
      SELECT 
        p.id,
        p.store_id,
        p.title,
        p.slug,
        p.image_url,
        p.partner_url,
        p.description,
        p.price_before,
        p.price_now,
        p.has_discount,
        -- Se discount_pct não estiver preenchido, calcula dinamicamente
        COALESCE(p.discount_pct, ROUND((1 - (p.price_now / NULLIF(p.price_before, 0))) * 100)) as discount_pct,
        p.has_coupon,
        p.coupon_code,
        p.has_credit_card,
        p.credit_card_price,
        p.max_installments,
        p.has_coupon_url,
        p.coupon_url_slug,
        p.coupon_url,
        p.starts_at,
        p.expires_at,
        p.status,
        p.promotion_type,
        p.views_count,
        p.clicks_count,
        p.created_at,
        p.updated_at,
        ${storeFields}
      FROM promotions p
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.slug = ? 
        AND p.status = 'published'
        AND (p.starts_at IS NULL OR p.starts_at <= NOW())
        AND p.expires_at > NOW()
    `;

    const results = await query(sql, [slug]);
    const product = results[0] || null;

    if (product && includeCategories) {
      product.categories = await this.getCategories(product.id);
    }

    if (product) {
      product.alternative_links = await this.getAlternativeLinks(product.id);
    }

    return product;
  }

  // Incrementar visualização por slug
  static async incrementViewBySlug(slug) {
    // 1) Incrementa contador acumulado (comportamento antigo, mantém dashboards atuais)
    const sql = `UPDATE promotions SET views_count = COALESCE(views_count, 0) + 1 WHERE slug = ? AND status = 'published'`;
    const result = await query(sql, [slug]);

    if (result.affectedRows === 0) {
      // Produto não encontrado ou não publicado
      return false;
    }

    // 2) Registra também na tabela diária, usando data em GMT-3 (Brasília)
    //    Isso alimenta os novos relatórios por dia/semana/mês/ano.
    await query(
      `
      INSERT INTO promotion_daily_metrics (promotion_id, metric_date, views)
      SELECT 
        id AS promotion_id,
        DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)) AS metric_date,
        1 AS views
      FROM promotions
      WHERE slug = ? AND status = 'published'
      ON DUPLICATE KEY UPDATE views = promotion_daily_metrics.views + VALUES(views)
      `,
      [slug]
    );

    return true;
  }

  // Buscar produtos por categoria
  static async findByCategory(categoryId, options = {}) {
    const {
      limit = 10,
      excludeId = null,
      include_store = true,
      include_categories = true
    } = options;

    const storeFields = include_store ? `
        s.name as store_name,
        s.slug as store_slug,
        s.logo_url as store_logo_url,
        s.affiliate_base_url as store_affiliate_base_url,
        s.default_params as store_default_params,
        s.status as store_status` : '';

    let sql = `
      SELECT DISTINCT
        p.id, p.store_id, p.title, p.slug, p.image_url, p.partner_url, p.description,
        p.price_before, p.price_now,
        COALESCE(p.discount_pct, ROUND(((p.price_before - p.price_now) / p.price_before) * 100)) as discount_pct,
        p.has_coupon, p.coupon_code, p.starts_at, p.expires_at, p.status, p.promotion_type,
        p.views_count, p.clicks_count, p.created_at, p.updated_at
        ${include_store ? `, ${storeFields}` : ''}
      FROM promotions p
      ${include_store ? `LEFT JOIN stores s ON p.store_id = s.id` : ''}
      INNER JOIN promotion_categories pc ON p.id = pc.promotion_id
      WHERE pc.category_id = ? AND p.status = 'published'
    `;

    const params = [categoryId];

    if (excludeId) {
      sql += ' AND p.id != ?';
      params.push(excludeId);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ?';
    params.push(limit);

    const results = await query(sql, params);

    // Adicionar categorias se solicitado
    if (include_categories && results.length > 0) {
      for (const product of results) {
        product.categories = await this.getCategories(product.id);
      }
    }

    return results;
  }

  // Gerar slug único
  static async generateSlug(title, excludeId = null) {
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-'); // Remove hífens duplicados

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const sql = excludeId 
        ? 'SELECT id FROM promotions WHERE slug = ? AND id != ?' 
        : 'SELECT id FROM promotions WHERE slug = ?';
      
      const params = excludeId ? [slug, excludeId] : [slug];
      const existing = await query(sql, params);
      
      if (existing.length === 0) {
        return slug;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // Criar produto
  static async create(productData) {
    console.log('🏗️ [PRODUCT CREATE] Iniciando criação no modelo');
    console.log('📊 [PRODUCT CREATE] Dados recebidos:', JSON.stringify(productData, null, 2));
    
    const {
      store_id,
      title,
      image_url,
      partner_url,
      description,
      price_before,
      price_now,
      has_discount = false,
      has_coupon,
      coupon_code,
      has_credit_card = false,
      credit_card_price,
      max_installments,
      has_coupon_url = false,
      coupon_url_slug,
      coupon_url,
      starts_at,
      expires_at,
      status = 'draft',
      has_custom_start_date = false,
      promotion_type = 'product',
      category_ids = [],
      alternative_links = []
    } = productData;
    
    console.log('🎯 [PRODUCT CREATE] Tipo de promoção:', promotion_type);
    console.log('🎯 [PRODUCT CREATE] Tem cupom:', has_coupon);
    console.log('🎯 [PRODUCT CREATE] Código do cupom:', coupon_code);
    console.log('🎯 [PRODUCT CREATE] Tem URL de cupom:', has_coupon_url);

    // Gerar slug único
    const slug = await this.generateSlug(title);

    // Determinar status baseado nas datas (apenas se não for draft)
    let finalStatus = status;
    if (status !== 'draft') {
      finalStatus = this.determineStatus(has_custom_start_date, starts_at, expires_at);
    }

    // Se não tem data de início personalizada, starts_at deve ser NULL
    const finalStartsAt = has_custom_start_date ? starts_at : null;

    const sql = `
      INSERT INTO promotions (
        id, store_id, title, slug, image_url, partner_url, description,
        price_before, price_now, has_discount, has_coupon, coupon_code,
        has_credit_card, credit_card_price, max_installments,
        has_coupon_url, coupon_url_slug, coupon_url,
        starts_at, expires_at, status, promotion_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `promotion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const params = [
      id,
      store_id,
      title,
      slug,
      image_url || null,
      partner_url || null,
      description || null,
      price_before ? parseFloat(price_before) : null,
      price_now ? parseFloat(price_now) : null,
      has_discount ? 1 : 0,
      has_coupon ? 1 : 0,
      coupon_code || null,
      has_credit_card ? 1 : 0,
      credit_card_price ? parseFloat(credit_card_price) : null,
      max_installments || null,
      has_coupon_url ? 1 : 0,
      coupon_url_slug || null,
      coupon_url || null,
      finalStartsAt ? formatDateForMySQL(finalStartsAt) : null,
      formatDateForMySQL(expires_at),
      finalStatus,
      promotion_type || 'product'
    ];

    console.log('💾 [PRODUCT CREATE] Executando INSERT no banco...');
    await query(sql, params);
    console.log('✅ [PRODUCT CREATE] INSERT executado com sucesso');
    
    // Definir categorias se fornecidas
    if (category_ids && category_ids.length > 0) {
      console.log('🏷️ [PRODUCT CREATE] Definindo categorias:', category_ids);
      await this.setCategories(id, category_ids);
    }

    // Definir links alternativos
    if (alternative_links && alternative_links.length > 0) {
      console.log('🔗 [PRODUCT CREATE] Definindo links alternativos');
      await this.setAlternativeLinks(id, alternative_links);
    }
    
    // Criar URL encurtada de cupom se ativada
    console.log('🔍 [PRODUCT CREATE] Verificando URL de cupom:', {
      has_coupon_url,
      coupon_url_slug,
      coupon_url,
      slugType: typeof coupon_url_slug,
      slugLength: coupon_url_slug ? coupon_url_slug.length : 0
    });
    
    if (has_coupon_url && coupon_url_slug && coupon_url) {
      try {
        console.log('🔗 [PRODUCT CREATE] Criando URL de cupom:', coupon_url_slug, '->', coupon_url);
        await ShortUrl.createCouponUrl(id, coupon_url_slug, coupon_url);
        console.log(`✅ [PRODUCT CREATE] URL de cupom criada: ${coupon_url_slug} -> ${coupon_url}`);
      } catch (error) {
        console.error('❌ [PRODUCT CREATE] Erro ao criar URL de cupom:', error);
        // Não falhar o produto por causa da URL
      }
    } else {
      console.log('⚠️ [PRODUCT CREATE] URL de cupom não criada - condições não atendidas');
    }
    
    console.log('🔍 [PRODUCT CREATE] Buscando produto criado...');
    const createdProduct = await this.findById(id);
    console.log('✅ [PRODUCT CREATE] Produto criado com sucesso:', createdProduct.id);
    return createdProduct;
  }

  // Atualizar produto
  static async update(id, productData) {
    const {
      store_id,
      title,
      image_url,
      partner_url,
      description,
      price_before,
      price_now,
      has_discount,
      has_coupon,
      coupon_code,
      has_credit_card,
      credit_card_price,
      max_installments,
      has_coupon_url,
      coupon_url_slug,
      coupon_url,
      starts_at,
      expires_at,
      status,
      has_custom_start_date,
      promotion_type,
      category_ids,
      alternative_links
    } = productData;

    // Gerar novo slug se o título mudou
    let slug = null;
    if (title) {
      const currentProduct = await this.findById(id);
      if (currentProduct && currentProduct.title !== title) {
        slug = await this.generateSlug(title, id);
      }
    }

    // Determinar status baseado nas datas se as datas mudaram
    let finalStatus = status;
    if (status && status !== 'draft' && (starts_at !== undefined || expires_at !== undefined)) {
      // Buscar dados atuais para comparar
      const currentProduct = await this.findById(id);
      const finalStartsAt = starts_at !== undefined ? starts_at : currentProduct.starts_at;
      const finalExpiresAt = expires_at !== undefined ? expires_at : currentProduct.expires_at;
      const finalHasCustomStart = has_custom_start_date !== undefined ? has_custom_start_date : (currentProduct.starts_at !== null);
      
      finalStatus = this.determineStatus(finalHasCustomStart, finalStartsAt, finalExpiresAt);
    }

    // Se não tem data de início personalizada, starts_at deve ser NULL
    let finalStartsAt = starts_at;
    if (has_custom_start_date === false) {
      finalStartsAt = null;
    }

    const sql = `
      UPDATE promotions SET
        store_id = COALESCE(?, store_id),
        title = COALESCE(?, title),
        slug = COALESCE(?, slug),
        image_url = COALESCE(?, image_url),
        partner_url = COALESCE(?, partner_url),
        description = COALESCE(?, description),
        price_before = COALESCE(?, price_before),
        price_now = COALESCE(?, price_now),
        has_discount = COALESCE(?, has_discount),
        has_coupon = COALESCE(?, has_coupon),
        coupon_code = COALESCE(?, coupon_code),
        has_credit_card = COALESCE(?, has_credit_card),
        credit_card_price = COALESCE(?, credit_card_price),
        max_installments = COALESCE(?, max_installments),
        has_coupon_url = COALESCE(?, has_coupon_url),
        coupon_url_slug = COALESCE(?, coupon_url_slug),
        coupon_url = COALESCE(?, coupon_url),
        starts_at = ?,
        expires_at = COALESCE(?, expires_at),
        status = COALESCE(?, status),
        promotion_type = COALESCE(?, promotion_type),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      store_id || null,
      title || null,
      slug,
      image_url === undefined ? undefined : (image_url || null),
      partner_url === undefined ? undefined : (partner_url || null),
      description === undefined ? undefined : (description || null),
      price_before ? parseFloat(price_before) : null,
      price_now ? parseFloat(price_now) : null,
      has_discount !== undefined ? (has_discount ? 1 : 0) : null,
      has_coupon !== undefined ? (has_coupon ? 1 : 0) : null,
      coupon_code === undefined ? undefined : (coupon_code || null),
      has_credit_card !== undefined ? (has_credit_card ? 1 : 0) : null,
      credit_card_price ? parseFloat(credit_card_price) : null,
      max_installments || null,
      has_coupon_url !== undefined ? (has_coupon_url ? 1 : 0) : null,
      coupon_url_slug === undefined ? undefined : (coupon_url_slug || null),
      coupon_url === undefined ? undefined : (coupon_url || null),
      finalStartsAt !== undefined ? (finalStartsAt ? formatDateForMySQL(finalStartsAt) : null) : null,
      expires_at ? formatDateForMySQL(expires_at) : null,
      finalStatus || null,
      promotion_type || null,
      id
    ];


    // Converter undefined para null para funcionar com COALESCE
    const sanitizedParams = params.map(param => param === undefined ? null : param);

    await query(sql, sanitizedParams);
    
    // Atualizar categorias se fornecidas
    if (category_ids !== undefined) {
      await this.setCategories(id, category_ids || []);
    }
    
    // Atualizar links alternativos se fornecidos
    if (alternative_links !== undefined) {
      await this.setAlternativeLinks(id, alternative_links || []);
    }
    
    // Gerenciar URL encurtada de cupom
    if (has_coupon_url !== undefined) {
      try {
        if (has_coupon_url && coupon_url_slug && coupon_url) {
          // Verificar se já existe URL de cupom para este produto
          const existingCouponUrl = await ShortUrl.findByProductIdAndType(id, 'coupon');
          
          if (existingCouponUrl) {
            // Atualizar URL existente (passar APENAS o id da short url)
            await ShortUrl.update(existingCouponUrl.id, {
              short_slug: coupon_url_slug,
              redirect_url: coupon_url,
              is_active: true
            });
            console.log(`✅ [PRODUCT] URL de cupom atualizada: ${coupon_url_slug} -> ${coupon_url}`);
          } else {
            // Criar nova URL
            await ShortUrl.createCouponUrl(id, coupon_url_slug, coupon_url);
            console.log(`✅ [PRODUCT] URL de cupom criada: ${coupon_url_slug} -> ${coupon_url}`);
          }
        } else if (!has_coupon_url) {
          // Deletar URL de cupom se checkbox desmarcado
          const existingCouponUrl = await ShortUrl.findByProductIdAndType(id, 'coupon');
          if (existingCouponUrl) {
            await ShortUrl.delete(existingCouponUrl.id);
            console.log(`✅ [PRODUCT] URL de cupom deletada`);
          }
        }
      } catch (error) {
        console.error('❌ [PRODUCT] Erro ao gerenciar URL de cupom:', error);
        // Não falhar o produto por causa da URL
      }
    }
    
    return this.findById(id);
  }

  // Deletar produto
  static async delete(id) {
    try {
      // Deletar URLs de cupom associadas
      await ShortUrl.deleteByProductId(id);
      
      // Deletar produto
      const sql = 'DELETE FROM promotions WHERE id = ?';
      const result = await query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('❌ [PRODUCT] Erro ao deletar produto:', error);
      throw error;
    }
  }

  // ========== MÉTODOS DE CATEGORIA ==========

  // Buscar categorias de um produto
  static async getCategories(productId) {
    const sql = `
      SELECT c.id, c.name, c.slug, c.status
      FROM categories c
      INNER JOIN promotion_categories pc ON c.id = pc.category_id
      WHERE pc.promotion_id = ? AND c.status = 'active'
      ORDER BY c.sort_order ASC, c.name ASC
    `;
    return await query(sql, [productId]);
  }

  // Definir categorias de um produto (substitui todas)
  static async setCategories(productId, categoryIds) {
    if (!Array.isArray(categoryIds)) {
      throw new Error('categoryIds deve ser um array');
    }

    // Validar se o produto existe
    const product = await this.findById(productId);
    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // Filtrar apenas IDs únicos e válidos
    const uniqueIds = [...new Set(categoryIds.filter(id => id && typeof id === 'string'))];
    
    if (uniqueIds.length === 0) {
      // Se não há categorias, apenas remove todas
      await query('DELETE FROM promotion_categories WHERE promotion_id = ?', [productId]);
      return [];
    }

    // Validar se todas as categorias existem e estão ativas
    const placeholders = uniqueIds.map(() => '?').join(',');
    const validCategories = await query(
      `SELECT id FROM categories WHERE id IN (${placeholders}) AND status = 'active'`,
      uniqueIds
    );

    const validIds = validCategories.map(cat => cat.id);
    const invalidIds = uniqueIds.filter(id => !validIds.includes(id));

    if (invalidIds.length > 0) {
      throw new Error(`Categorias inválidas ou inativas: ${invalidIds.join(', ')}`);
    }

    // Substituir categorias sem transação explícita (MySQL auto-commit)
    try {
      // Remove todas as categorias atuais
      await query('DELETE FROM promotion_categories WHERE promotion_id = ?', [productId]);
      
      // Adiciona as novas categorias
      if (validIds.length > 0) {
        for (const categoryId of validIds) {
          await query(
            'INSERT INTO promotion_categories (promotion_id, category_id) VALUES (?, ?)',
            [productId, categoryId]
          );
        }
      }
      
      // Retorna as categorias atualizadas
      return await this.getCategories(productId);
      
    } catch (error) {
      throw error;
    }
  }

  // Adicionar categorias a um produto (merge)
  static async addCategories(productId, categoryIds) {
    if (!Array.isArray(categoryIds)) {
      throw new Error('categoryIds deve ser um array');
    }

    // Buscar categorias atuais
    const currentCategories = await this.getCategories(productId);
    const currentIds = currentCategories.map(cat => cat.id);
    
    // Combinar com as novas (únicos)
    const allIds = [...new Set([...currentIds, ...categoryIds])];
    
    // Usar setCategories para aplicar
    return await this.setCategories(productId, allIds);
  }

  // Remover categoria específica de um produto
  static async removeCategory(productId, categoryId) {
    const result = await query(
      'DELETE FROM promotion_categories WHERE promotion_id = ? AND category_id = ?',
      [productId, categoryId]
    );
    return result.affectedRows > 0;
  }

  // Buscar produtos por categoria (método auxiliar)
  static async findByCategory(categoryId, options = {}) {
    return await this.findAll({
      ...options,
      category_id: categoryId
    });
  }

  // Obter estatísticas dos produtos
  static async getStats() {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM promotions
    `;

    const results = await query(sql);
    const stats = results[0] || { total: 0, active: 0, draft: 0, scheduled: 0, expired: 0 };

    const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active) || 0,
      draft: parseInt(stats.draft) || 0,
      scheduled: parseInt(stats.scheduled) || 0,
      expired: parseInt(stats.expired) || 0,
      active_rate: activeRate
    };
  }

  // ========================================
  // NOVAS FUNÇÕES PARA SISTEMA DE DATAS
  // ========================================

  // Publicar promoções agendadas cujo horário de início chegou
  static async publishScheduledPromotions() {
    const sql = `
      UPDATE promotions 
      SET status = 'published', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'scheduled' 
        AND starts_at IS NOT NULL 
        AND starts_at <= NOW()
    `;

    try {
      const result = await query(sql);
      console.log(`✅ Publicadas ${result.affectedRows} promoções agendadas`);
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Erro ao publicar promoções agendadas:', error);
      throw error;
    }
  }

  // Expirar promoções cujo horário de fim passou
  static async expirePromotions() {
    const sql = `
      UPDATE promotions 
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'published' 
        AND expires_at < NOW()
    `;

    try {
      const result = await query(sql);
      console.log(`⏰ Expiradas ${result.affectedRows} promoções`);
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Erro ao expirar promoções:', error);
      throw error;
    }
  }

  // Determinar status baseado nas datas (função auxiliar)
  static determineStatus(hasCustomStartDate, startsAt, expiresAt) {
    const now = new Date();
    const startDate = startsAt ? new Date(startsAt) : null;
    const endDate = new Date(expiresAt);

    // Se já expirou
    if (endDate <= now) {
      return 'expired';
    }

    // Se tem data de início personalizada e ainda não chegou
    if (hasCustomStartDate && startDate && startDate > now) {
      return 'scheduled';
    }

    // Caso contrário, está publicado (ou será publicado imediatamente)
    return 'published';
  }

  // Buscar apenas promoções ativas (considerando datas)
  static async findActivePromotions(options = {}) {
    const baseOptions = {
      ...options,
      status: 'published'
    };

    // Adicionar filtro de data nas consultas públicas
    const originalOptions = { ...baseOptions };
    
    // Modificar whereConditions para incluir verificação de datas
    const results = await this.findAll(originalOptions);
    
    // Filtrar no nível de aplicação para garantir que estão ativas
    if (results.data) {
      const now = new Date();
      results.data = results.data.filter(promotion => {
        const startDate = promotion.starts_at ? new Date(promotion.starts_at) : null;
        const endDate = new Date(promotion.expires_at);
        
        // Deve estar dentro do período válido
        const hasStarted = !startDate || startDate <= now;
        const notExpired = endDate > now;
        
        return hasStarted && notExpired;
      });
    }

    return results;
  }

  // Listar promoções agendadas
  static async findScheduledPromotions(options = {}) {
    return await this.findAll({
      ...options,
      status: 'scheduled'
    });
  }

  // Buscar produtos por termo de busca (público)
  static async searchProducts(searchTerm, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = 'relevance',
      include_store = false,
      include_categories = false
    } = options;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construir query base
    let baseQuery = `
      SELECT DISTINCT p.*
      ${include_store ? `, s.name as store_name, s.slug as store_slug, s.logo_url as store_logo_url, 
                          s.affiliate_base_url as store_affiliate_base_url, s.default_params as store_default_params, 
                          s.status as store_status` : ''}
      FROM promotions p
      ${include_store ? 'LEFT JOIN stores s ON p.store_id = s.id' : ''}
      ${include_categories ? 'LEFT JOIN promotion_categories pc ON p.id = pc.promotion_id LEFT JOIN categories c ON pc.category_id = c.id' : ''}
      WHERE p.status = 'published'
      AND (p.starts_at IS NULL OR p.starts_at <= NOW())
      AND p.expires_at > NOW()
      AND (
        p.title LIKE ? 
        OR p.slug LIKE ?
        ${include_store ? 'OR s.name LIKE ?' : ''}
        ${include_categories ? 'OR c.name LIKE ?' : ''}
      )
    `;

    // Parâmetros da busca
    const searchPattern = `%${searchTerm}%`;
    let params = [searchPattern, searchPattern];
    
    if (include_store) {
      params.push(searchPattern);
    }
    
    if (include_categories) {
      params.push(searchPattern);
    }

    // Ordenação
    let orderBy = 'p.created_at DESC'; // Padrão
    
    switch (sort) {
      case 'price-asc':
        orderBy = 'p.price_now ASC';
        break;
      case 'price-desc':
        orderBy = 'p.price_now DESC';
        break;
      case 'name-asc':
        orderBy = 'p.title ASC';
        break;
      case 'name-desc':
        orderBy = 'p.title DESC';
        break;
      case 'newest':
        orderBy = 'p.created_at DESC';
        break;
      case 'relevance':
      default:
        // Ordenar por relevância (título exato primeiro, depois parcial)
        orderBy = `
          CASE 
            WHEN p.title LIKE '${searchTerm}%' THEN 1
            WHEN p.title LIKE '%${searchTerm}%' THEN 2
            ELSE 3
          END,
          p.created_at DESC
        `;
        break;
    }

    baseQuery += ` ORDER BY ${orderBy}`;

    // Query com paginação
    const dataQuery = baseQuery + ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    
    // Query para contar total
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM promotions p
      ${include_store ? 'LEFT JOIN stores s ON p.store_id = s.id' : ''}
      ${include_categories ? 'LEFT JOIN promotion_categories pc ON p.id = pc.promotion_id LEFT JOIN categories c ON pc.category_id = c.id' : ''}
      WHERE p.status = 'published'
      AND (p.starts_at IS NULL OR p.starts_at <= NOW())
      AND p.expires_at > NOW()
      AND (
        p.title LIKE ? 
        OR p.slug LIKE ?
        ${include_store ? 'OR s.name LIKE ?' : ''}
        ${include_categories ? 'OR c.name LIKE ?' : ''}
      )
    `;

    // Executar queries
    const [products, [{ total }]] = await Promise.all([
      query(dataQuery, params),
      query(countQuery, params)
    ]);

    // Buscar categorias se solicitado
    if (include_categories && products.length > 0) {
      const productIds = products.map(p => p.id);
      const placeholders = productIds.map(() => '?').join(',');
      
      const categoriesQuery = `
        SELECT pc.promotion_id, c.id, c.name, c.slug, c.status
        FROM promotion_categories pc
        JOIN categories c ON pc.category_id = c.id
        WHERE pc.promotion_id IN (${placeholders})
        AND c.status = 'active'
        ORDER BY c.name
      `;
      
      const categoriesData = await query(categoriesQuery, productIds);
      
      // Agrupar categorias por produto
      const categoriesByProduct = {};
      categoriesData.forEach(cat => {
        if (!categoriesByProduct[cat.promotion_id]) {
          categoriesByProduct[cat.promotion_id] = [];
        }
        categoriesByProduct[cat.promotion_id].push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          status: cat.status
        });
      });
      
      // Adicionar categorias aos produtos
      products.forEach(product => {
        product.categories = categoriesByProduct[product.id] || [];
      });
    }

    return {
      data: products,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(total),
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next: parseInt(page) * parseInt(limit) < total,
        has_prev: parseInt(page) > 1
      }
    };
  }
  // ========================================
  // LINKS ALTERNATIVOS
  // ========================================

  static async getAlternativeLinks(productId) {
    const sql = `
      SELECT l.id, l.store_id, l.url, l.clicks_count,
             s.name as store_name, s.slug as store_slug, s.logo_url as store_logo_url
      FROM promotion_alternative_links l
      INNER JOIN stores s ON l.store_id = s.id
      WHERE l.promotion_id = ? AND s.status = 'active'
      ORDER BY l.id ASC
    `;
    return await query(sql, [productId]);
  }

  static async setAlternativeLinks(productId, links) {
    if (!Array.isArray(links)) return [];
    
    try {
      await query('DELETE FROM promotion_alternative_links WHERE promotion_id = ?', [productId]);
      
      for (const link of links) {
        if (link.store_id && link.url) {
          await query(
            'INSERT INTO promotion_alternative_links (promotion_id, store_id, url) VALUES (?, ?, ?)',
            [productId, link.store_id, link.url]
          );
        }
      }
      return await this.getAlternativeLinks(productId);
    } catch (error) {
      throw error;
    }
  }

  static async incrementAlternativeLinkClick(linkId) {
    const sql = 'UPDATE promotion_alternative_links SET clicks_count = clicks_count + 1 WHERE id = ?';
    const result = await query(sql, [linkId]);
    return result.affectedRows > 0;
  }
}

export default Product; 