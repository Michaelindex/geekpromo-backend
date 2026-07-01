import { query } from '../config/database.js';

// Função auxiliar para formatar data para MySQL
function formatDateForMySQL(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Remover tags HTML básicas, retornando texto puro
function stripHtml(value) {
  if (!value) return null;
  const stringValue = String(value);
  const withoutTags = stringValue.replace(/<[^>]*>/g, '').trim();
  return withoutTags || null;
}

class Coupon {
  // Buscar todos os cupons com paginação e filtros
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 10,
      search,
      store_id,
      status,
      discount_type,
      featured,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = options;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [];
    let params = [];

    // Filtro por busca (title ou code)
    if (search) {
      whereConditions.push('(c.title LIKE ? OR c.code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filtro por status
    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status);
    }

    // Filtro por loja
    if (store_id) {
      whereConditions.push('c.store_id = ?');
      params.push(store_id);
    }

    // Filtro por tipo de desconto
    if (discount_type) {
      whereConditions.push('c.discount_type = ?');
      params.push(discount_type);
    }

    // Filtro por destaque
    if (featured !== undefined) {
      whereConditions.push('c.featured = ?');
      params.push(featured ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Usar apenas campos básicos que devem existir
    const validSortFields = ['created_at', 'title', 'code', 'status', 'discount_value', 'featured'];
    const finalSortBy = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const finalSortOrder = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

    const sql = `
      SELECT
        c.id,
        c.title,
        c.code,
        c.description,
        c.terms,
        c.discount_type,
        c.discount_value,
        c.expires_at,
        c.store_id,
        c.promotion_id,
        c.status,
        c.featured,
        c.redirect_url,
        c.created_at,
        c.updated_at,
        s.name as store_name
      FROM coupons c
      LEFT JOIN stores s ON c.store_id = s.id
      ${whereClause}
      ORDER BY c.${finalSortBy} ${finalSortOrder}
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM coupons c
      ${whereClause}
    `;

    const [coupons, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params)
    ]);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    return {
      data: coupons,
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

  // Buscar cupom por ID
  static async findById(id) {
    const sql = `
      SELECT
        c.id,
        c.title,
        c.code,
        c.description,
        c.terms,
        c.discount_type,
        c.discount_value,
        c.expires_at,
        c.store_id,
        c.promotion_id,
        c.status,
        c.featured,
        c.redirect_url,
        c.created_at,
        c.updated_at,
        s.name as store_name
      FROM coupons c
      LEFT JOIN stores s ON c.store_id = s.id
      WHERE c.id = ?
    `;

    const results = await query(sql, [id]);
    return results[0] || null;
  }

  // Buscar cupom por código (LEGADO - mantido para compatibilidade)
  static async findByCode(code, excludeId = null) {
    const sql = excludeId 
      ? 'SELECT id FROM coupons WHERE UPPER(code) = UPPER(?) AND id != ?' 
      : 'SELECT id FROM coupons WHERE UPPER(code) = UPPER(?)';
    
    const params = excludeId ? [code, excludeId] : [code];
    const result = await query(sql, params);
    return result[0] || null;
  }

  // Buscar cupom por código e loja (NOVO - validação correta)
  static async findByCodeAndStore(code, storeId, excludeId = null) {
    const sql = excludeId 
      ? 'SELECT id FROM coupons WHERE UPPER(code) = UPPER(?) AND store_id = ? AND id != ?' 
      : 'SELECT id FROM coupons WHERE UPPER(code) = UPPER(?) AND store_id = ?';
    
    const params = excludeId ? [code, storeId, excludeId] : [code, storeId];
    const result = await query(sql, params);
    return result[0] || null;
  }

  // Buscar cupom por promotion_id (para integração com produtos)
  static async findByPromotionId(promotionId) {
    const sql = `
      SELECT
        c.id,
        c.title,
        c.code,
        c.description,
        c.terms,
        c.discount_type,
        c.discount_value,
        c.expires_at,
        c.store_id,
        c.promotion_id,
        c.status,
        c.featured,
        c.redirect_url,
        c.created_at,
        c.updated_at
      FROM coupons c
      WHERE c.promotion_id = ?
    `;

    const results = await query(sql, [promotionId]);
    return results[0] || null;
  }

  // Criar cupom com desconto
  // options.replaceIfExists: se true, apaga cupom existente com mesmo código+loja antes de criar (sem lançar erro de duplicidade)
  static async create(couponData, options = {}) {
    const { replaceIfExists = false } = options;

    const {
      title,
      code,
      description,
      store_id,
      terms,
      discount_type = 'percentage',
      discount_value = 0,
      expires_at,
      status = 'draft',
      featured = false,
      redirect_url,
      promotion_id = null
    } = couponData;

    // Validações de desconto
    if (discount_value < 0) {
      throw new Error('Valor do desconto deve ser maior ou igual a 0');
    }

    if (discount_type === 'percentage' && discount_value > 100) {
      throw new Error('Porcentagem de desconto não pode ser maior que 100%');
    }

    // Validar / tratar duplicidade de código POR LOJA (apenas se código for fornecido)
    if (code && code.trim() !== '') {
      const existingCoupon = await this.findByCodeAndStore(code, store_id);

      if (existingCoupon) {
        if (replaceIfExists) {
          // Fluxo especial: substituir automaticamente o cupom antigo
          console.log('🔄 [COUPON][CREATE] Código duplicado encontrado para esta loja. Apagando cupom antigo antes de criar o novo...', {
            code,
            store_id,
            existing_coupon_id: existingCoupon.id,
            promotion_id
          });

          await this.delete(existingCoupon.id);

          console.log('✅ [COUPON][CREATE] Cupom antigo apagado com sucesso. Prosseguindo com criação do novo cupom.');
        } else {
          // Fluxo padrão: manter validação atual
          throw new Error('Código do cupom já existe para esta loja');
        }
      }
    }

    const sql = `
      INSERT INTO coupons (
        id, title, code, description, store_id, terms, discount_type, discount_value, expires_at, status, featured, redirect_url, promotion_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = `coupon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Formatar código: se fornecido, converter para uppercase; se não, null
    const formattedCode = code && code.trim() !== '' ? code.toUpperCase().trim() : null;
    
    const params = [
      id,
      title,
      formattedCode,
      // description e terms não podem ser NULL na tabela; garantir string vazia como fallback
      description ?? '',
      store_id,
      terms ?? '',
      discount_type,
      discount_value,
      formatDateForMySQL(expires_at),
      status,
      featured,
      redirect_url || null,
      promotion_id
    ];

    await query(sql, params);
    return this.findById(id);
  }

  // Atualizar cupom com desconto
  static async update(id, couponData) {
    const {
      title,
      code,
      description,
      store_id,
      terms,
      discount_type,
      discount_value,
      expires_at,
      status,
      featured,
      redirect_url,
      promotion_id
    } = couponData;

    // Validações de desconto se fornecidos
    if (discount_value !== undefined && discount_value < 0) {
      throw new Error('Valor do desconto deve ser maior ou igual a 0');
    }

    if (discount_type && discount_value !== undefined && discount_type === 'percentage' && discount_value > 100) {
      throw new Error('Porcentagem de desconto não pode ser maior que 100%');
    }

    // Validar se código não existe PARA ESTA LOJA (excluindo o próprio cupom)
    // Apenas se código for fornecido e não for null/vazio
    if (code !== undefined && code !== null && code.trim() !== '' && store_id) {
      const existingCoupon = await this.findByCodeAndStore(code, store_id, id);
      if (existingCoupon) {
        throw new Error('Código do cupom já existe para esta loja');
      }
    }

    const sql = `
      UPDATE coupons SET
        title = COALESCE(?, title),
        code = COALESCE(?, code),
        description = ?,
        terms = COALESCE(?, terms),
        discount_type = COALESCE(?, discount_type),
        discount_value = COALESCE(?, discount_value),
        expires_at = COALESCE(?, expires_at),
        store_id = COALESCE(?, store_id),
        status = COALESCE(?, status),
        featured = COALESCE(?, featured),
        redirect_url = COALESCE(?, redirect_url),
        promotion_id = COALESCE(?, promotion_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    // Formatar código: se fornecido e não null, converter para uppercase; se null/vazio, null
    let formattedCode = null;
    if (code !== undefined) {
      if (code !== null && code.trim() !== '') {
        formattedCode = code.toUpperCase().trim();
      } else {
        formattedCode = null;
      }
    }
    
    const params = [
      title || null,
      formattedCode,
      description === undefined ? undefined : (description || null),
      terms === undefined ? undefined : (terms || null),
      discount_type || null,
      discount_value !== undefined ? discount_value : null,
      expires_at === undefined ? undefined : formatDateForMySQL(expires_at),
      store_id || null,
      status || null,
      featured !== undefined ? featured : null,
      redirect_url === undefined ? undefined : (redirect_url || null),
      promotion_id === undefined ? undefined : (promotion_id || null),
      id
    ];

    // Converter undefined para null para funcionar com COALESCE
    const sanitizedParams = params.map(param => param === undefined ? null : param);

    await query(sql, sanitizedParams);
    return this.findById(id);
  }

  // Deletar cupom
  static async delete(id) {
    // Verificar se cupom existe
    const existingCoupon = await this.findById(id);
    if (!existingCoupon) {
      throw new Error('Cupom não encontrado');
    }

    const result = await query('DELETE FROM coupons WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Buscar cupons para select (id, title, code)
  static async findForSelect() {
    try {
      const result = await query(
        'SELECT id, title, code FROM coupons WHERE status = "active" ORDER BY title ASC'
      );
      return result;
    } catch (error) {
      console.error('Erro ao buscar cupons para select:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Estatísticas dos cupons (versão básica)
  static async getStats() {
    try {
      const [totalResult, activeResult, draftResult, expiredResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM coupons'),
        query('SELECT COUNT(*) as count FROM coupons WHERE status = "active"'),
        query('SELECT COUNT(*) as count FROM coupons WHERE status = "draft"'),
        query('SELECT COUNT(*) as count FROM coupons WHERE status = "expired"')
      ]);

      const total = totalResult[0].count;
      const active = activeResult[0].count;
      const draft = draftResult[0].count;
      const expired = expiredResult[0].count;

      return {
        total,
        active,
        draft,
        expired,
        active_rate: total > 0 ? Math.round((active / total) * 100) : 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas de cupons:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Expirar cupons automaticamente
  static async expireCoupons() {
    try {
      const sql = `
        UPDATE coupons 
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active' 
          AND expires_at < NOW()
      `;

      const result = await query(sql);
      const expiredCount = result.affectedRows || 0;
      
      if (expiredCount > 0) {
        console.log(`⏰ [COUPON] ${expiredCount} cupons foram expirados automaticamente`);
      } else {
        console.log('ℹ️ [COUPON] Nenhum cupom encontrado para expiração');
      }
      
      return expiredCount;
    } catch (error) {
      console.error('❌ [COUPON] Erro ao expirar cupons:', error);
      throw error;
    }
  }

  // Incrementar contador de uso do cupom
  static async incrementUsage(id) {
    try {
      const sql = `
        UPDATE coupons 
        SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `;

      const result = await query(sql, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Cupom não encontrado ou inativo');
      }

      // Registrar também na tabela diária, usando data em GMT-3 (Brasília)
      await query(
        `
        INSERT INTO coupon_daily_metrics (coupon_id, metric_date, copies)
        VALUES (
          ?, 
          DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), 
          1
        )
        ON DUPLICATE KEY UPDATE copies = coupon_daily_metrics.copies + VALUES(copies)
        `,
        [id]
      );

      console.log(`📊 [COUPON] Click registrado para cupom ${id}`);
      return true;
    } catch (error) {
      console.error('❌ [COUPON] Erro ao incrementar uso do cupom:', error);
      throw error;
    }
  }

  // ============================
  // Integração com Promoções
  // ============================

  // Mapear status de promoção para status de cupom
  static mapPromotionStatusToCouponStatus(promotionStatus) {
    switch (promotionStatus) {
      case 'published':
        return 'active';
      case 'expired':
        return 'expired';
      case 'draft':
      case 'scheduled':
      default:
        return 'draft';
    }
  }

  // Montar dados de cupom a partir de uma promoção do tipo cupom
  static buildCouponDataFromPromotion(promotion, data) {
    if (!promotion) {
      throw new Error('Promoção inválida para criação de cupom');
    }

    // Garantir que description/terms nunca sejam NULL (alguns campos na tabela são NOT NULL)
    const descriptionText = stripHtml(promotion.description) || promotion.title || '';
    const termsText = stripHtml(data.terms) || '';

    return {
      title: promotion.title,
      store_id: promotion.store_id,
      // Garantir que o cadastro de CUPOM use texto puro (sem tags HTML) e não NULL
      description: descriptionText,
      terms: termsText,
      discount_type: data.discount_type || 'percentage',
      discount_value: Number(data.discount_value ?? 0),
      expires_at: promotion.expires_at,
      status: this.mapPromotionStatusToCouponStatus(promotion.status),
      featured: Boolean(data.featured),
      redirect_url: data.redirect_url || data.partner_url || null,
      // Se for link direto, não há código
      code: data.is_direct_link ? null : (data.coupon_code || data.code || null),
      promotion_id: promotion.id
    };
  }

  // Criar cupom vinculado a uma promoção
  static async createFromPromotion(promotion, data) {
    const couponData = this.buildCouponDataFromPromotion(promotion, data);
    // Aqui usamos replaceIfExists=true para substituir automaticamente
    // cupons com mesmo código+loja, seguindo a regra definida pelo usuário.
    return this.create(couponData, { replaceIfExists: true });
  }

  // Atualizar (ou criar) cupom vinculado a uma promoção
  static async updateFromPromotion(promotion, data) {
    const existing = await this.findByPromotionId(promotion.id);
    const couponData = this.buildCouponDataFromPromotion(promotion, data);

    if (existing) {
      return this.update(existing.id, {
        ...couponData,
        // garantir que store_id esteja disponível para validações de código
        store_id: couponData.store_id
      });
    }

    return this.create(couponData);
  }
}

export default Coupon; 