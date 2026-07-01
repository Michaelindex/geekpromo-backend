import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class Store {
  // Listar lojas com filtros e paginação
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'sort_order_asc'
    } = options;

    try {
      // Construir query base
      let baseQuery = 'SELECT id, name, slug, logo_url, affiliate_base_url, default_params, status, sort_order, use_custom_order, created_at, updated_at FROM stores';
      let countQuery = 'SELECT COUNT(*) as total FROM stores';
      let conditions = [];
      let params = [];

      // Filtros
      if (search) {
        conditions.push('(name LIKE ? OR slug LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      // Adicionar WHERE se houver condições
      if (conditions.length > 0) {
        const whereClause = ` WHERE ${conditions.join(' AND ')}`;
        baseQuery += whereClause;
        countQuery += whereClause;
      }

      // Ordenação
      let orderBy = ' ORDER BY sort_order ASC, name ASC';
      switch (sort) {
        case 'sort_order_asc':
          orderBy = ' ORDER BY sort_order ASC, name ASC';
          break;
        case 'sort_order_desc':
          orderBy = ' ORDER BY sort_order DESC, name DESC';
          break;
        case 'name_asc':
          orderBy = ' ORDER BY name ASC';
          break;
        case 'name_desc':
          orderBy = ' ORDER BY name DESC';
          break;
        case 'created_asc':
          orderBy = ' ORDER BY created_at ASC';
          break;
        case 'created_desc':
          orderBy = ' ORDER BY created_at DESC';
          break;
        case 'updated_desc':
          orderBy = ' ORDER BY updated_at DESC';
          break;
      }

      baseQuery += orderBy;

      // Paginação
      const offset = (page - 1) * limit;
      baseQuery += ` LIMIT ${limit} OFFSET ${offset}`;

      // Executar queries
      const [stores, countResult] = await Promise.all([
        query(baseQuery, params),
        query(countQuery, params)
      ]);

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);

      return {
        data: stores,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error('Erro ao buscar lojas:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Buscar loja por ID
  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM stores WHERE id = ?',
        [id]
      );

      return result[0] || null;
    } catch (error) {
      console.error('Erro ao buscar loja por ID:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Buscar loja por slug
  static async findBySlug(slug) {
    try {
      const result = await query(
        'SELECT * FROM stores WHERE slug = ?',
        [slug]
      );

      return result[0] || null;
    } catch (error) {
      console.error('Erro ao buscar loja por slug:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Gerar slug único
  static async generateUniqueSlug(name, excludeId = null) {
    // Gerar slug base do nome
    let baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .replace(/^-|-$/g, ''); // Remove hífens no início e fim

    // Se o slug ficou vazio, usar um padrão
    if (!baseSlug) {
      baseSlug = 'loja';
    }

    let slug = baseSlug;
    let counter = 1;
    const maxAttempts = 100; // Evitar loop infinito

    // Verificar se slug já existe
    while (counter <= maxAttempts) {
      try {
        let checkQuery = 'SELECT id FROM stores WHERE slug = ?';
        let params = [slug];

        // Se estiver editando, excluir o próprio registro
        if (excludeId) {
          checkQuery += ' AND id != ?';
          params.push(excludeId);
        }

        const existing = await query(checkQuery, params);

        if (existing.length === 0) {
          break; // Slug disponível
        }

        // Tentar próximo slug
        counter++;
        slug = `${baseSlug}-${counter}`;
      } catch (error) {
        console.error('Erro ao verificar slug:', error);
        // Se der erro, usar um slug com timestamp
        return `${baseSlug}-${Date.now()}`;
      }
    }

    // Se chegou ao limite, usar timestamp
    if (counter > maxAttempts) {
      return `${baseSlug}-${Date.now()}`;
    }

    return slug;
  }

  // Criar nova loja
  static async create(storeData) {
    const {
      name,
      slug: customSlug,
      logo_url = '',
      affiliate_base_url = '',
      default_params = '',
      status = 'active',
      sort_order = 0,
      use_custom_order = false
    } = storeData;

    // Validações básicas
    if (!name || name.trim().length < 2) {
      throw new Error('Nome da loja é obrigatório e deve ter pelo menos 2 caracteres');
    }

    if (!affiliate_base_url || affiliate_base_url.trim().length === 0) {
      throw new Error('URL base de afiliado é obrigatória');
    }

    // Validar URL base de afiliado
    try {
      new URL(affiliate_base_url);
    } catch {
      throw new Error('URL base de afiliado deve ser uma URL válida');
    }

    // Validar ordenação personalizada
    if (use_custom_order && sort_order < 1) {
      throw new Error('Quando usar ordem personalizada, a posição deve ser maior que 0');
    }

    // Verificar duplicação de sort_order se usar ordem personalizada
    if (use_custom_order && sort_order > 0) {
      const existingWithSameOrder = await query(
        'SELECT id, name FROM stores WHERE sort_order = ? AND use_custom_order = 1',
        [sort_order]
      );
      
      if (existingWithSameOrder.length > 0) {
        throw new Error(`Já existe uma loja na posição ${sort_order}: ${existingWithSameOrder[0].name}`);
      }
    }

    // Gerar slug único
    const finalSlug = customSlug 
      ? await this.generateUniqueSlug(customSlug)
      : await this.generateUniqueSlug(name);

    const id = uuidv4();

    try {
      await query(
        `INSERT INTO stores 
         (id, name, slug, logo_url, affiliate_base_url, default_params, status, sort_order, use_custom_order) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), finalSlug, logo_url, affiliate_base_url, default_params, status, parseInt(sort_order) || 0, use_custom_order ? 1 : 0]
      );

      return await this.findById(id);
    } catch (error) {
      console.error('Erro ao criar loja:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Já existe uma loja com este slug');
      }
      
      throw new Error('Erro interno do servidor');
    }
  }

  // Atualizar loja
  static async update(id, storeData) {
    const {
      name,
      slug: customSlug,
      logo_url,
      affiliate_base_url,
      default_params,
      status,
      sort_order,
      use_custom_order
    } = storeData;

    // Verificar se loja existe
    const existingStore = await this.findById(id);
    if (!existingStore) {
      throw new Error('Loja não encontrada');
    }

    // Validações básicas
    if (name !== undefined && (!name || name.trim().length < 2)) {
      throw new Error('Nome da loja deve ter pelo menos 2 caracteres');
    }

    if (affiliate_base_url !== undefined && (!affiliate_base_url || affiliate_base_url.trim().length === 0)) {
      throw new Error('URL base de afiliado é obrigatória');
    }

    // Validar URL base de afiliado se fornecida
    if (affiliate_base_url !== undefined) {
      try {
        new URL(affiliate_base_url);
      } catch {
        throw new Error('URL base de afiliado deve ser uma URL válida');
      }
    }

    // Validar ordenação personalizada
    const finalUseCustomOrder = use_custom_order !== undefined ? use_custom_order : existingStore.use_custom_order;
    const finalSortOrder = sort_order !== undefined ? sort_order : existingStore.sort_order;

    if (finalUseCustomOrder && finalSortOrder < 1) {
      throw new Error('Quando usar ordem personalizada, a posição deve ser maior que 0');
    }

    // Verificar duplicação de sort_order se usar ordem personalizada
    if (finalUseCustomOrder && finalSortOrder > 0) {
      const existingWithSameOrder = await query(
        'SELECT id, name FROM stores WHERE sort_order = ? AND use_custom_order = 1 AND id != ?',
        [finalSortOrder, id]
      );
      
      if (existingWithSameOrder.length > 0) {
        throw new Error(`Já existe uma loja na posição ${finalSortOrder}: ${existingWithSameOrder[0].name}`);
      }
    }

    // Gerar novo slug se nome ou slug customizado foi alterado
    let finalSlug = existingStore.slug;
    if (name !== undefined || customSlug !== undefined) {
      const slugSource = customSlug !== undefined ? customSlug : name;
      if (slugSource !== undefined) {
        finalSlug = await this.generateUniqueSlug(slugSource, id);
      }
    }

    // Construir query de atualização dinamicamente
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (finalSlug !== existingStore.slug) {
      updateFields.push('slug = ?');
      updateValues.push(finalSlug);
    }

    if (logo_url !== undefined) {
      updateFields.push('logo_url = ?');
      updateValues.push(logo_url);
    }

    if (affiliate_base_url !== undefined) {
      updateFields.push('affiliate_base_url = ?');
      updateValues.push(affiliate_base_url);
    }

    if (default_params !== undefined) {
      updateFields.push('default_params = ?');
      updateValues.push(default_params);
    }

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(parseInt(sort_order) || 0);
    }

    if (use_custom_order !== undefined) {
      updateFields.push('use_custom_order = ?');
      updateValues.push(use_custom_order ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return existingStore; // Nada para atualizar
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    try {
      await query(
        `UPDATE stores SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      return await this.findById(id);
    } catch (error) {
      console.error('Erro ao atualizar loja:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Já existe uma loja com este slug');
      }
      
      throw new Error('Erro interno do servidor');
    }
  }

  // Deletar loja
  static async delete(id) {
    // Verificar se loja existe
    const existingStore = await this.findById(id);
    if (!existingStore) {
      throw new Error('Loja não encontrada');
    }

    // Verificar se há produtos vinculados
    const linkedProducts = await query('SELECT COUNT(*) as count FROM promotions WHERE store_id = ?', [id]);
    if (linkedProducts[0].count > 0) {
      throw new Error('Não é possível deletar loja que possui produtos vinculados');
    }

    try {
      await query('DELETE FROM stores WHERE id = ?', [id]);
      return { success: true, message: 'Loja deletada com sucesso' };
    } catch (error) {
      console.error('Erro ao deletar loja:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Buscar lojas para select (id, name)
  static async findForSelect() {
    try {
      const result = await query(
        'SELECT id, name FROM stores WHERE status = "active" ORDER BY sort_order ASC, name ASC'
      );

      return result;
    } catch (error) {
      console.error('Erro ao buscar lojas para select:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Estatísticas das lojas
  static async getStats() {
    try {
      const [totalResult, activeResult, inactiveResult] = await Promise.all([
        query('SELECT COUNT(*) as count FROM stores'),
        query('SELECT COUNT(*) as count FROM stores WHERE status = "active"'),
        query('SELECT COUNT(*) as count FROM stores WHERE status = "inactive"')
      ]);

      const total = totalResult[0].count;
      const active = activeResult[0].count;
      const inactive = inactiveResult[0].count;

      return {
        total,
        active,
        inactive,
        activePercentage: total > 0 ? Math.round((active / total) * 100) : 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas das lojas:', error);
      throw new Error('Erro interno do servidor');
    }
  }

  // Incrementar contador de cliques da loja
  static async incrementClicks(id) {
    try {
      const sql = `
        UPDATE stores 
        SET clicks_count = clicks_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `;

      const result = await query(sql, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Loja não encontrada ou inativa');
      }
      
      console.log(`📊 [STORE TRACKING] Click registrado para loja ${id}`);
      return true;
    } catch (error) {
      console.error('❌ [STORE TRACKING] Erro ao incrementar cliques da loja:', error);
      throw error;
    }
  }
}

export default Store; 