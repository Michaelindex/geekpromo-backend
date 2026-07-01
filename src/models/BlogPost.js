import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

// Helper para converter datas (Date ou string ISO) para formato MySQL 'YYYY-MM-DD HH:MM:SS'
function toMySQLDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

class BlogPost {
  static async findAll(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      category_id = '',
      author_name = '',
      date_from = '',
      date_to = '',
      sort = 'published_at',
      order = 'DESC',
      include_categories = false
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Busca por título ou conteúdo
    if (search) {
      whereConditions.push('(bp.title LIKE ? OR bp.content LIKE ? OR bp.excerpt LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Filtro por status
    if (status) {
      whereConditions.push('bp.status = ?');
      queryParams.push(status);
    }

    // Filtro por categoria
    if (category_id) {
      whereConditions.push('EXISTS (SELECT 1 FROM blog_post_categories bpc WHERE bpc.post_id = bp.id AND bpc.category_id = ?)');
      queryParams.push(category_id);
    }

    // Filtro por autor
    if (author_name) {
      whereConditions.push('bp.author_name LIKE ?');
      queryParams.push(`%${author_name}%`);
    }

    // Filtro por data
    if (date_from) {
      whereConditions.push('DATE(bp.published_at) >= ?');
      queryParams.push(date_from);
    }
    if (date_to) {
      whereConditions.push('DATE(bp.published_at) <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Campos de categorias (se solicitado)
    const categoryFields = include_categories ? `
      , (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT('id', bc.id, 'name', bc.name, 'slug', bc.slug)
        )
        FROM blog_post_categories bpc
        JOIN blog_categories bc ON bpc.category_id = bc.id
        WHERE bpc.post_id = bp.id
      ) as categories
    ` : '';

    // Query principal
    const selectQuery = `
      SELECT 
        bp.id, bp.title, bp.slug, bp.cover_image, bp.cover_image_alt, bp.excerpt, bp.content,
        bp.author_name, bp.meta_description, bp.meta_keywords, bp.status, bp.published_at,
        bp.views_count, bp.created_at, bp.updated_at, bp.seo_title, bp.seo_description, bp.og_image_url
        ${categoryFields}
      FROM blog_posts bp
      ${whereClause}
      ORDER BY bp.${sort} ${order}
      LIMIT ? OFFSET ?
    `;

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM blog_posts bp
      ${whereClause}
    `;

    queryParams.push(parseInt(limit), parseInt(offset));
    const countParams = queryParams.slice(0, -2);

    const posts = await query(selectQuery, queryParams);
    const countResult = await query(countQuery, countParams);

    // Processar categorias JSON
    if (include_categories && Array.isArray(posts)) {
      posts.forEach(post => {
        try {
          post.categories = post.categories ? JSON.parse(post.categories) : [];
        } catch (e) {
          post.categories = [];
        }
      });
    }

    const total = countResult?.[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: posts || [],
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

  static async findById(id, includeCategories = false) {
    const categoryFields = includeCategories ? `
      , (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT('id', bc.id, 'name', bc.name, 'slug', bc.slug)
        )
        FROM blog_post_categories bpc
        JOIN blog_categories bc ON bpc.category_id = bc.id
        WHERE bpc.post_id = ?
      ) as categories
    ` : '';

    const selectQuery = `
      SELECT 
        id, title, slug, cover_image, cover_image_alt, excerpt, content,
        author_name, meta_description, meta_keywords, status, published_at,
        views_count, created_at, updated_at, seo_title, seo_description, og_image_url
        ${categoryFields}
      FROM blog_posts 
      WHERE id = ?
    `;

    const params = includeCategories ? [id, id] : [id];
    const posts = await query(selectQuery, params);
    
    if (posts && posts[0] && includeCategories) {
      try {
        posts[0].categories = posts[0].categories ? JSON.parse(posts[0].categories) : [];
      } catch (e) {
        posts[0].categories = [];
      }
    }

    return (posts && posts[0]) ? posts[0] : null;
  }

  static async findBySlug(slug, includeCategories = false) {
    const posts = await query(
      'SELECT * FROM blog_posts WHERE slug = ?',
      [slug]
    );
    
    if (posts && posts[0] && includeCategories) {
      const categories = await this.getCategories(posts[0].id);
      posts[0].categories = categories;
    }

    return (posts && posts[0]) ? posts[0] : null;
  }

  static async generateUniqueSlug(title, excludeId = null) {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let checkQuery = 'SELECT id FROM blog_posts WHERE slug = ?';
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

  static async create(postData) {
    const id = uuidv4();
    const {
      title, cover_image, cover_image_alt, excerpt, content, author_name,
      meta_description, meta_keywords, status, published_at, seo_title,
      seo_description, og_image_url, category_ids = []
    } = postData;

    // Gerar slug único
    const slug = await this.generateUniqueSlug(title);

    const insertQuery = `
      INSERT INTO blog_posts (
        id, title, slug, cover_image, cover_image_alt, excerpt, content,
        author_name, meta_description, meta_keywords, status, published_at,
        seo_title, seo_description, og_image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(insertQuery, [
      id, title, slug, cover_image || null, cover_image_alt || null,
      excerpt, content, author_name || 'GeeGloko', meta_description || null,
      meta_keywords || null, status || 'draft', toMySQLDateTime(published_at),
      seo_title || null, seo_description || null, og_image_url || null
    ]);

    // Associar categorias se fornecidas
    if (category_ids && category_ids.length > 0) {
      await this.setCategories(id, category_ids);
    }

    return await this.findById(id, true);
  }

  static async update(id, postData) {
    const {
      title, cover_image, cover_image_alt, excerpt, content, author_name,
      meta_description, meta_keywords, status, published_at, seo_title,
      seo_description, og_image_url, category_ids
    } = postData;

    // Se título mudou, gerar novo slug
    let slug = null;
    if (title) {
      const current = await this.findById(id);
      if (current && current.title !== title) {
        slug = await this.generateUniqueSlug(title, id);
      }
    }

    const updateFields = [];
    const updateParams = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(title);
    }
    if (slug) {
      updateFields.push('slug = ?');
      updateParams.push(slug);
    }
    if (cover_image !== undefined) {
      updateFields.push('cover_image = ?');
      updateParams.push(cover_image);
    }
    if (cover_image_alt !== undefined) {
      updateFields.push('cover_image_alt = ?');
      updateParams.push(cover_image_alt);
    }
    if (excerpt !== undefined) {
      updateFields.push('excerpt = ?');
      updateParams.push(excerpt);
    }
    if (content !== undefined) {
      updateFields.push('content = ?');
      updateParams.push(content);
    }
    if (author_name !== undefined) {
      updateFields.push('author_name = ?');
      updateParams.push(author_name);
    }
    if (meta_description !== undefined) {
      updateFields.push('meta_description = ?');
      updateParams.push(meta_description);
    }
    if (meta_keywords !== undefined) {
      updateFields.push('meta_keywords = ?');
      updateParams.push(meta_keywords);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    if (published_at !== undefined) {
      updateFields.push('published_at = ?');
      updateParams.push(toMySQLDateTime(published_at));
    }
    if (seo_title !== undefined) {
      updateFields.push('seo_title = ?');
      updateParams.push(seo_title);
    }
    if (seo_description !== undefined) {
      updateFields.push('seo_description = ?');
      updateParams.push(seo_description);
    }
    if (og_image_url !== undefined) {
      updateFields.push('og_image_url = ?');
      updateParams.push(og_image_url);
    }

    if (updateFields.length === 0 && category_ids === undefined) {
      throw new Error('Nenhum campo para atualizar fornecido');
    }

    // Atualizar campos do post se houver
    if (updateFields.length > 0) {
      updateParams.push(id);

      const updateQuery = `
        UPDATE blog_posts 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const result = await query(updateQuery, updateParams);

      if (result.affectedRows === 0) {
        throw new Error('Post não encontrado');
      }
    }

    // Atualizar categorias se fornecidas
    if (category_ids !== undefined) {
      await this.setCategories(id, category_ids);
    }

    return await this.findById(id, true);
  }

  static async delete(id) {
    const result = await query('DELETE FROM blog_posts WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw new Error('Post não encontrado');
    }

    return { message: 'Post excluído com sucesso' };
  }

  // Métodos para gerenciar categorias
  static async getCategories(postId) {
    const categories = await query(`
      SELECT bc.id, bc.name, bc.slug
      FROM blog_categories bc
      JOIN blog_post_categories bpc ON bc.id = bpc.category_id
      WHERE bpc.post_id = ?
      ORDER BY bc.name
    `, [postId]);

    return categories;
  }

  static async setCategories(postId, categoryIds) {
    // Remover categorias existentes
    await query('DELETE FROM blog_post_categories WHERE post_id = ?', [postId]);

    // Adicionar novas categorias
    if (categoryIds && categoryIds.length > 0) {
      const insertPromises = categoryIds.map(categoryId =>
        query('INSERT INTO blog_post_categories (post_id, category_id) VALUES (?, ?)', [postId, categoryId])
      );
      await Promise.all(insertPromises);
    }

    return await this.getCategories(postId);
  }

  static async addCategories(postId, categoryIds) {
    if (!categoryIds || categoryIds.length === 0) return [];

    const insertPromises = categoryIds.map(categoryId =>
      query('INSERT IGNORE INTO blog_post_categories (post_id, category_id) VALUES (?, ?)', [postId, categoryId])
    );
    await Promise.all(insertPromises);

    return await this.getCategories(postId);
  }

  static async removeCategory(postId, categoryId) {
    await query('DELETE FROM blog_post_categories WHERE post_id = ? AND category_id = ?', [postId, categoryId]);
    return await this.getCategories(postId);
  }

  static async incrementViews(id) {
    await query('UPDATE blog_posts SET views_count = views_count + 1 WHERE id = ?', [id]);
  }

  static async getStats() {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN DATE(published_at) = CURDATE() AND status = 'published' THEN 1 ELSE 0 END) as published_today,
        SUM(CASE WHEN published_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status = 'published' THEN 1 ELSE 0 END) as published_last_7_days
      FROM blog_posts
    `);

    const result = (Array.isArray(stats) ? stats[0] : stats) || { total: 0, published: 0, draft: 0, archived: 0, published_today: 0, published_last_7_days: 0 };
    
    // Converter BigInt para Number se necessário
    const total = Number(result.total) || 0;
    const published = Number(result.published) || 0;
    const draft = Number(result.draft) || 0;
    const archived = Number(result.archived) || 0;
    const publishedToday = Number(result.published_today) || 0;
    const publishedLast7Days = Number(result.published_last_7_days) || 0;
    
    const publishedRate = total > 0 ? Math.round((published / total) * 100) : 0;

    return {
      total,
      published,
      draft,
      archived,
      published_rate: publishedRate,
      published_today: publishedToday,
      published_last_7_days: publishedLast7Days
    };
  }

  // Método para busca pública (posts publicados)
  static async findPublished(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      category_slug = '',
      sort = 'published_at',
      order = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = ['bp.status = "published"', 'bp.published_at <= NOW()'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(bp.title LIKE ? OR bp.excerpt LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category_slug) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM blog_post_categories bpc 
        JOIN blog_categories bc ON bpc.category_id = bc.id 
        WHERE bpc.post_id = bp.id AND bc.slug = ?
      )`);
      queryParams.push(category_slug);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        bp.id, bp.title, bp.slug, bp.cover_image, bp.excerpt, bp.author_name,
        bp.published_at, bp.views_count,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT('id', bc.id, 'name', bc.name, 'slug', bc.slug)
          )
          FROM blog_post_categories bpc
          JOIN blog_categories bc ON bpc.category_id = bc.id
          WHERE bpc.post_id = bp.id
        ) as categories
      FROM blog_posts bp
      ${whereClause}
      ORDER BY bp.${sort} ${order}
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const posts = await query(selectQuery, queryParams);

    // Processar categorias JSON
    posts.forEach(post => {
      try {
        post.categories = post.categories ? JSON.parse(post.categories) : [];
      } catch (e) {
        post.categories = [];
      }
    });

    return {
      data: posts,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit)
      }
    };
  }
}

export default BlogPost; 