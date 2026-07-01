import db from '../config/database.js';

class ShortUrl {
  /**
   * Criar uma nova URL curta para produto
   */
  static async create(productId, shortSlug, isCustom = false) {
    try {
      // Verificar se o slug já existe
      const existing = await this.findBySlug(shortSlug);
      if (existing) {
        throw new Error(`Slug '${shortSlug}' já está em uso`);
      }

      if (isCustom) {
        // Verificar se já existe uma custom de PRODUTO para este produto (ativa ou não)
        // Importante: não considerar URLs de CUPOM aqui
        const [rows] = await db.execute(
          "SELECT id FROM product_short_urls WHERE product_id = ? AND is_custom = 1 AND (url_type IS NULL OR url_type = 'product') LIMIT 1",
          [productId]
        );
        if (rows.length > 0) {
          // Fazer update no registro existente
          const existingId = rows[0].id;
          await db.execute(
            'UPDATE product_short_urls SET short_slug = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [shortSlug, existingId]
          );
          // Desativar outras custom (em teoria não existe, mas manter)
          await this.deactivateOld(productId, true, existingId);
          return await this.findById(existingId);
        }
      }

      // Se chegou aqui, inserir novo registro
      const insert = `INSERT INTO product_short_urls (product_id, short_slug, is_custom, is_active) VALUES (?, ?, ?, ?)`;
      const [result] = await db.execute(insert, [productId, shortSlug, isCustom, true]);
      const newId = result.insertId;
      
      if (isCustom) {
        await this.deactivateOld(productId, true, newId);
      }
      
      return await this.findById(newId);
       
    } catch (error) {
      console.error('Erro ao criar URL curta:', error);
      throw error;
    }
  }

  /**
   * Buscar URL curta por slug
   */
  static async findBySlug(shortSlug) {
    try {
      const query = `
        SELECT psu.*, p.slug as product_slug, p.title as product_title
        FROM product_short_urls psu
        INNER JOIN promotions p ON psu.product_id = p.id
        WHERE psu.short_slug = ? AND psu.is_active = 1
      `;
      
      const [rows] = await db.execute(query, [shortSlug]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erro ao buscar URL curta por slug:', error);
      throw error;
    }
  }

  /**
   * Buscar URL curta por ID
   */
  static async findById(id) {
    try {
      const query = `
        SELECT psu.*, p.slug as product_slug, p.title as product_title
        FROM product_short_urls psu
        INNER JOIN promotions p ON psu.product_id = p.id
        WHERE psu.id = ?
      `;
      
      const [rows] = await db.execute(query, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erro ao buscar URL curta por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar URLs curtas por produto
   */
  static async findByProductId(productId, isCustom = null) {
    try {
      let query = `
        SELECT * FROM product_short_urls
        WHERE product_id = ? AND is_active = 1
      `;
      
      const params = [productId];
      
      if (isCustom !== null) {
        query += ' AND is_custom = ?';
        params.push(isCustom);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const [rows] = await db.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Erro ao buscar URLs curtas por produto:', error);
      throw error;
    }
  }

  /**
   * Gerar slug automático baseado no título
   */
  static async generateAutoSlug(productTitle) {
    try {
      // Limpar e normalizar o título
      const cleanTitle = productTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .trim();

      // Estratégia de encurtamento
      const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
      
      let baseSlug = '';
      
      // Pegar primeira letra de cada palavra + números
      for (const word of words) {
        if (word.match(/^\d+$/)) {
          // Se for número, adicionar completo
          baseSlug += word;
        } else if (word.length >= 3) {
          // Se palavra >= 3 chars, pegar primeira letra
          baseSlug += word.charAt(0);
        }
        
        // Limitar a 8 caracteres base
        if (baseSlug.length >= 6) break;
      }

      // Se slug muito pequeno, pegar mais caracteres
      if (baseSlug.length < 3) {
        baseSlug = cleanTitle.replace(/\s+/g, '').substring(0, 6);
      }

      // Garantir slug único
      let finalSlug = baseSlug;
      let counter = 1;
      
      while (await this.findBySlug(finalSlug)) {
        finalSlug = baseSlug + counter;
        counter++;
        
        // Limitar tentativas
        if (counter > 999) {
          finalSlug = baseSlug + Date.now().toString().slice(-3);
          break;
        }
      }

      return finalSlug;
    } catch (error) {
      console.error('Erro ao gerar slug automático:', error);
      throw error;
    }
  }

  /**
   * Validar slug
   */
  static async validateSlug(slug, excludeId = null) {
    try {
      // Validações de formato
      if (!slug || slug.length < 3 || slug.length > 50) {
        return { valid: false, error: 'Slug deve ter entre 3 e 50 caracteres' };
      }

      // Caracteres permitidos
      if (!/^[a-z0-9.-]+$/.test(slug)) {
        return { valid: false, error: 'Slug pode conter apenas letras minúsculas, números, pontos e hífens' };
      }

      // Slugs reservados
      const reserved = ['admin', 'api', 'new', 'edit', 'delete', 'create', 'update'];
      if (reserved.includes(slug)) {
        return { valid: false, error: 'Slug não pode usar palavras reservadas' };
      }

      // Verificar unicidade
      const existing = await this.findBySlug(slug);
      if (existing && (!excludeId || existing.id !== excludeId)) {
        return { valid: false, error: 'Slug já está em uso' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Erro ao validar slug:', error);
      return { valid: false, error: 'Erro interno na validação' };
    }
  }

  /**
   * Desativar URLs antigas
   */
  static async deactivateOld(productId, isCustom, excludeId = null) {
    try {
      let query = `
        UPDATE product_short_urls 
        SET is_active = 0 
        WHERE product_id = ? AND is_custom = ?
      `;
      
      const params = [productId, isCustom];
      
      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }
      
      await db.execute(query, params);
    } catch (error) {
      console.error('Erro ao desativar URLs antigas:', error);
      throw error;
    }
  }

  /**
   * Atualizar URL curta
   */
  static async update(id, data) {
    try {
      const shortUrl = await this.findById(id);
      if (!shortUrl) {
        throw new Error('URL curta não encontrada');
      }

      const fields = [];
      const values = [];

      if (data.short_slug !== undefined) {
        // Validar novo slug
        const validation = await this.validateSlug(data.short_slug, id);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        fields.push('short_slug = ?');
        values.push(data.short_slug);
      }

      if (data.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(data.is_active);
      }

      // Permitir atualizar redirect_url (usado para URLs de cupom)
      if (data.redirect_url !== undefined) {
        fields.push('redirect_url = ?');
        values.push(data.redirect_url || null);
      }

      if (fields.length === 0) {
        return shortUrl;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `
        UPDATE product_short_urls 
        SET ${fields.join(', ')}
        WHERE id = ?
      `;

      await db.execute(query, values);
      return await this.findById(id);
    } catch (error) {
      console.error('Erro ao atualizar URL curta:', error);
      throw error;
    }
  }

  /**
   * Deletar URL curta
   */
  static async delete(id) {
    try {
      const query = 'DELETE FROM product_short_urls WHERE id = ?';
      const [result] = await db.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Erro ao deletar URL curta:', error);
      throw error;
    }
  }

  /**
   * Listar todas as URLs curtas com paginação
   */
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        productId,
        isCustom,
        isActive = true
      } = options;

      const offset = (page - 1) * limit;
      
      let whereConditions = [];
      let params = [];

      if (productId) {
        whereConditions.push('psu.product_id = ?');
        params.push(productId);
      }

      if (isCustom !== undefined) {
        whereConditions.push('psu.is_custom = ?');
        params.push(isCustom);
      }

      if (isActive !== undefined) {
        whereConditions.push('psu.is_active = ?');
        params.push(isActive);
      }

      const whereClause = whereConditions.length > 0 ? 
        'WHERE ' + whereConditions.join(' AND ') : '';

      const query = `
        SELECT psu.*, p.slug as product_slug, p.title as product_title
        FROM product_short_urls psu
        INNER JOIN promotions p ON psu.product_id = p.id
        ${whereClause}
        ORDER BY psu.created_at DESC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);
      
      const [rows] = await db.execute(query, params);

      // Contar total para paginação
      const countQuery = `
        SELECT COUNT(*) as total
        FROM product_short_urls psu
        INNER JOIN promotions p ON psu.product_id = p.id
        ${whereClause}
      `;

      const [countRows] = await db.execute(countQuery, params.slice(0, -2));
      const total = countRows[0].total;

      return {
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Erro ao listar URLs curtas:', error);
      throw error;
    }
  }

  /**
   * Criar uma nova URL curta para cupom
   */
  static async createCouponUrl(productId, shortSlug, redirectUrl) {
    try {
      // Verificar se o slug já existe
      const existing = await this.findBySlug(shortSlug);
      if (existing) {
        throw new Error(`Slug '${shortSlug}' já está em uso`);
      }

      // Inserir nova URL curta para cupom
      const insert = `INSERT INTO product_short_urls (product_id, short_slug, redirect_url, is_custom, is_active, url_type) VALUES (?, ?, ?, ?, ?, ?)`;
      const [result] = await db.execute(insert, [productId, shortSlug, redirectUrl, true, true, 'coupon']);
      const newId = result.insertId;
      
      return await this.findById(newId);
       
    } catch (error) {
      console.error('Erro ao criar URL curta para cupom:', error);
      throw error;
    }
  }

  /**
   * Buscar URL curta por produto e tipo
   */
  static async findByProductIdAndType(productId, urlType) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM product_short_urls WHERE product_id = ? AND url_type = ? LIMIT 1',
        [productId, urlType]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Erro ao buscar URL por produto e tipo:', error);
      throw error;
    }
  }

  /**
   * Deletar todas as URLs de um produto
   */
  static async deleteByProductId(productId) {
    try {
      const [result] = await db.execute(
        'DELETE FROM product_short_urls WHERE product_id = ?',
        [productId]
      );
      
      console.log(`✅ [SHORT-URL] ${result.affectedRows} URLs deletadas para produto ${productId}`);
      return result.affectedRows;
    } catch (error) {
      console.error('Erro ao deletar URLs por produto:', error);
      throw error;
    }
  }
}

export default ShortUrl;
