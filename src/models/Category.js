import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

class Category {
  // Buscar todas as categorias com filtros e paginação
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort_by = 'sort_order',
      sort_order = 'ASC'
    } = options;

    let sql = 'SELECT * FROM categories WHERE 1=1';
    const params = [];

    // Filtro de busca (name ou slug)
    if (search.trim()) {
      sql += ' AND (name LIKE ? OR slug LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    // Filtro de status
    if (status && ['active', 'inactive'].includes(status)) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // Ordenação
    const validSortFields = ['name', 'slug', 'sort_order', 'created_at', 'updated_at'];
    const validSortOrder = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'sort_order';
    const sortDirection = validSortOrder.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'ASC';
    
    sql += ` ORDER BY ${sortField} ${sortDirection}`;

    // Paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    // Buscar dados
    const categories = await query(sql, params);

    // Buscar total para paginação
    let countSql = 'SELECT COUNT(*) as total FROM categories WHERE 1=1';
    const countParams = [];

    if (search.trim()) {
      countSql += ' AND (name LIKE ? OR slug LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm);
    }

    if (status && ['active', 'inactive'].includes(status)) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [{ total }] = await query(countSql, countParams);

    return {
      data: categories,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit)
      }
    };
  }

  // Buscar categoria por ID
  static async findById(id) {
    const sql = 'SELECT * FROM categories WHERE id = ?';
    const [category] = await query(sql, [id]);
    return category || null;
  }

  // Buscar categoria por slug
  static async findBySlug(slug) {
    const sql = 'SELECT * FROM categories WHERE slug = ?';
    const [category] = await query(sql, [slug]);
    return category || null;
  }

  // Gerar slug único
  static async generateSlug(name, excludeId = null) {
    if (!name) throw new Error('Nome é obrigatório para gerar slug');

    let baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .trim('-');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let sql = 'SELECT id FROM categories WHERE slug = ?';
      const params = [slug];

      if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
      }

      const [existing] = await query(sql, params);

      if (!existing) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // Criar nova categoria
  static async create(categoryData) {
    const { name, description, image_url, icon, parent_id, sort_order, status } = categoryData;

    if (!name || name.trim().length < 3) {
      throw new Error('Nome da categoria deve ter pelo menos 3 caracteres');
    }

    const id = uuidv4();
    const slug = await this.generateSlug(name);

    const sql = `
      INSERT INTO categories (id, name, slug, description, image_url, icon, parent_id, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      name.trim(),
      slug,
      description || null,
      image_url || null,
      icon || null,
      parent_id || null,
      parseInt(sort_order) || 0,
      status && ['active', 'inactive'].includes(status) ? status : 'active'
    ];

    await query(sql, params);
    return await this.findById(id);
  }

  // Atualizar categoria
  static async update(id, categoryData) {
    const existingCategory = await this.findById(id);
    if (!existingCategory) {
      throw new Error('Categoria não encontrada');
    }

    const { name, description, image_url, icon, parent_id, sort_order, use_custom_order, status } = categoryData;
    
    // Validações
    if (name !== undefined && (!name || name.trim().length < 3)) {
      throw new Error('Nome da categoria deve ter pelo menos 3 caracteres');
    }

    // Gerar novo slug se o nome mudou
    let slug = existingCategory.slug;
    if (name && name.trim() !== existingCategory.name) {
      slug = await this.generateSlug(name, id);
    }

    const sql = `
      UPDATE categories 
      SET name = COALESCE(?, name),
          slug = ?,
          description = ?,
          image_url = ?,
          icon = ?,
          parent_id = ?,
          sort_order = COALESCE(?, sort_order),
          use_custom_order = COALESCE(?, use_custom_order),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      name ? name.trim() : null,
      slug,
      description !== undefined ? description : null,
      image_url !== undefined ? image_url : null,
      icon !== undefined ? icon : null,
      parent_id !== undefined ? parent_id : null,
      sort_order !== undefined ? parseInt(sort_order) : null,
      use_custom_order !== undefined ? (use_custom_order ? 1 : 0) : null,
      status && ['active', 'inactive'].includes(status) ? status : null,
      id
    ];

    await query(sql, params);
    return await this.findById(id);
  }

  // Deletar categoria
  static async delete(id) {
    const existingCategory = await this.findById(id);
    if (!existingCategory) {
      return false;
    }

    // Verificar se tem subcategorias
    const [hasChildren] = await query('SELECT id FROM categories WHERE parent_id = ? LIMIT 1', [id]);
    if (hasChildren) {
      throw new Error('Não é possível deletar categoria que possui subcategorias');
    }

    // Verificar se tem produtos vinculados
    const [hasProducts] = await query('SELECT promotion_id FROM promotion_categories WHERE category_id = ? LIMIT 1', [id]);
    if (hasProducts) {
      throw new Error('Não é possível deletar categoria que possui produtos vinculados');
    }

    const sql = 'DELETE FROM categories WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Buscar categorias para select (ativas, ordenadas)
  static async findForSelect() {
    const sql = 'SELECT id, name, slug FROM categories WHERE status = ? ORDER BY sort_order ASC, name ASC';
    return await query(sql, ['active']);
  }

  // Contar categorias por status
  static async getStats() {
    const sql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM categories 
      GROUP BY status
    `;
    const stats = await query(sql);
    
    const result = { active: 0, inactive: 0, total: 0 };
    stats.forEach(stat => {
      result[stat.status] = stat.count;
      result.total += stat.count;
    });
    
    return result;
  }

  // Buscar top categorias ordenadas por número de produtos ativos
  static async findTopCategoriesWithProductCount(limit = 20) {
    const sql = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.image_url,
        c.icon,
        c.status,
        c.sort_order,
        c.use_custom_order,
        c.created_at,
        c.updated_at,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN promotion_categories pc ON c.id = pc.category_id
      LEFT JOIN promotions p ON pc.promotion_id = p.id 
        AND p.status = 'published'
        AND (p.starts_at IS NULL OR p.starts_at <= NOW())
        AND p.expires_at > NOW()
      WHERE c.status = 'active'
      GROUP BY c.id, c.name, c.slug, c.description, c.image_url, c.icon, c.status, c.sort_order, c.use_custom_order, c.created_at, c.updated_at
      ORDER BY 
        CASE WHEN c.use_custom_order = 1 THEN c.sort_order ELSE 999999 END ASC,
        CASE WHEN c.use_custom_order = 0 THEN COUNT(p.id) ELSE 0 END DESC,
        c.name ASC
      LIMIT ?
    `;

    console.log('🔍 [DEBUG] Category.findTopCategoriesWithProductCount - SQL Query:', sql);
    console.log('🔍 [DEBUG] Category.findTopCategoriesWithProductCount - Limit:', parseInt(limit));
    
    const categories = await query(sql, [parseInt(limit)]);
    
    console.log('🔍 [DEBUG] Category.findTopCategoriesWithProductCount - Results:', categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      use_custom_order: cat.use_custom_order,
      sort_order: cat.sort_order,
      product_count: cat.product_count
    })));
    
    return {
      data: categories,
      total: categories.length
    };
  }

  // Incrementar contador de cliques da categoria
  static async incrementClicks(id) {
    try {
      const sql = `
        UPDATE categories 
        SET clicks_count = clicks_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `;

      const result = await query(sql, [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Categoria não encontrada ou inativa');
      }
      
      console.log(`📊 [CATEGORY TRACKING] Click registrado para categoria ${id}`);
      return true;
    } catch (error) {
      console.error('❌ [CATEGORY TRACKING] Erro ao incrementar cliques da categoria:', error);
      throw error;
    }
  }

  // Forçar deleção de categoria (remove vínculos e deleta)
  static async forceDelete(id) {
    const existingCategory = await this.findById(id);
    if (!existingCategory) {
      throw new Error('Categoria não encontrada');
    }

    // Verificar se tem subcategorias (bloquear por segurança)
    const [hasChildren] = await query('SELECT id FROM categories WHERE parent_id = ? LIMIT 1', [id]);
    if (hasChildren) {
      throw new Error('Não é possível forçar deleção de categoria que possui subcategorias. Remova ou mova as subcategorias primeiro.');
    }

    try {
      // Contar vínculos antes de remover
      const [countResult] = await query('SELECT COUNT(*) as count FROM promotion_categories WHERE category_id = ?', [id]);
      const removedLinks = countResult.count;

      // Remover todos os vínculos com produtos
      await query('DELETE FROM promotion_categories WHERE category_id = ?', [id]);
      console.log(`🗑️ [FORCE DELETE] Removidos ${removedLinks} vínculos da categoria ${id}`);

      // Deletar a categoria
      const result = await query('DELETE FROM categories WHERE id = ?', [id]);
      
      if (result.affectedRows === 0) {
        throw new Error('Erro ao deletar categoria');
      }

      console.log(`✅ [FORCE DELETE] Categoria ${id} deletada com sucesso`);
      
      return {
        success: true,
        removed_links: removedLinks,
        category_name: existingCategory.name
      };
    } catch (error) {
      console.error('❌ [FORCE DELETE] Erro ao forçar deleção da categoria:', error);
      throw error;
    }
  }
}

export default Category; 