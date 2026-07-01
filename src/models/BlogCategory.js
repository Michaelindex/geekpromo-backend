import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

class BlogCategory {
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'sort_order',
      order = 'ASC'
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Busca por nome
    if (search) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Filtro por status
    if (status) {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query principal
    const selectQuery = `
      SELECT 
        id, name, slug, description, image_url, sort_order, status, created_at, updated_at,
        (SELECT COUNT(*) FROM blog_post_categories bpc WHERE bpc.category_id = bc.id) as posts_count
      FROM blog_categories bc
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `;

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM blog_categories bc
      ${whereClause}
    `;

    queryParams.push(parseInt(limit), parseInt(offset));
    const countParams = queryParams.slice(0, -2); // Remove limit e offset para contagem

    const [categories] = await query(selectQuery, queryParams);
    const [countResult] = await query(countQuery, countParams);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: categories || [],
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total,
        total_pages: totalPages,
        has_prev: page > 1,
        has_next: page < totalPages
      }
    };
  }

  static async findById(id) {
    const selectQuery = `
      SELECT 
        id, name, slug, description, image_url, sort_order, status, created_at, updated_at,
        (SELECT COUNT(*) FROM blog_post_categories bpc WHERE bpc.category_id = ?) as posts_count
      FROM blog_categories 
      WHERE id = ?
    `;

    const [categories] = await query(selectQuery, [id, id]);
    return (categories && categories[0]) ? categories[0] : null;
  }

  static async findBySlug(slug) {
    const [categories] = await query(
      'SELECT * FROM blog_categories WHERE slug = ?',
      [slug]
    );
    return (categories && categories[0]) ? categories[0] : null;
  }

  static async generateUniqueSlug(name, excludeId = null) {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let checkQuery = 'SELECT id FROM blog_categories WHERE slug = ?';
      let params = [slug];

      if (excludeId) {
        checkQuery += ' AND id != ?';
        params.push(excludeId);
      }

      const [existing] = await query(checkQuery, params);

      if (!existing || existing.length === 0) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  static async create(categoryData) {
    const id = uuidv4();
    const { name, description, image_url, sort_order, status } = categoryData;

    // Gerar slug único
    const slug = await this.generateUniqueSlug(name);

    const insertQuery = `
      INSERT INTO blog_categories (id, name, slug, description, image_url, sort_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await query(insertQuery, [
      id,
      name,
      slug,
      description || null,
      image_url || null,
      sort_order || 0,
      status || 'active'
    ]);

    return await this.findById(id);
  }

  static async update(id, categoryData) {
    const { name, description, image_url, sort_order, status } = categoryData;

    // Se nome mudou, gerar novo slug
    let slug = null;
    if (name) {
      const current = await this.findById(id);
      if (current && current.name !== name) {
        slug = await this.generateUniqueSlug(name, id);
      }
    }

    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    if (slug) {
      updateFields.push('slug = ?');
      updateParams.push(slug);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(description);
    }
    if (image_url !== undefined) {
      updateFields.push('image_url = ?');
      updateParams.push(image_url);
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateParams.push(sort_order);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('Nenhum campo para atualizar fornecido');
    }

    updateParams.push(id);

    const updateQuery = `
      UPDATE blog_categories 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const [result] = await query(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      throw new Error('Categoria não encontrada');
    }

    return await this.findById(id);
  }

  static async delete(id) {
    // Verificar se a categoria tem posts vinculados
    const [posts] = await query(
      'SELECT COUNT(*) as count FROM blog_post_categories WHERE category_id = ?',
      [id]
    );

    if (posts[0].count > 0) {
      throw new Error('Não é possível excluir categoria com posts vinculados');
    }

    const [result] = await query('DELETE FROM blog_categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new Error('Categoria não encontrada');
    }

    return { message: 'Categoria excluída com sucesso' };
  }

  static async findForSelect() {
    const [categories] = await query(
      'SELECT id, name FROM blog_categories WHERE status = "active" ORDER BY sort_order ASC, name ASC'
    );
    return categories;
  }

  static async getStats() {
    const [stats] = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive
      FROM blog_categories
    `);

    const result = stats || { total: 0, active: 0, inactive: 0 };
    
    // Converter BigInt para Number se necessário
    const total = Number(result.total) || 0;
    const active = Number(result.active) || 0;
    const inactive = Number(result.inactive) || 0;
    
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

    return {
      total,
      active,
      inactive,
      active_rate: activeRate
    };
  }
}

export default BlogCategory; 