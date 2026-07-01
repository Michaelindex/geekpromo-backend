import { query } from '../config/database.js';

async function safeQuery(sql, params = [], fallback = 0) {
  try {
    const rows = await query(sql, params);
    return rows;
  } catch (err) {
    console.warn('Dashboard query falhou, retornando fallback:', err?.message);
    return [{ count: fallback }];
  }
}

export const getSummary = async (req, res, next) => {
  try {
    const [productCounts, categoryTotal, storeTotal, blogCounts, visitorsLast30d, conversions] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft
        FROM promotions
      `),
      query(`SELECT COUNT(*) AS total FROM categories`),
      query(`SELECT COUNT(*) AS total FROM stores`),
      query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
        FROM blog_posts
      `).catch(() => [{ total: 0, published: 0 }]),
      // Distinct sessions (analytics pode não existir)
      safeQuery(
        `SELECT COUNT(DISTINCT session_id) AS count FROM analytics WHERE event = 'page_view' AND timestamp >= NOW() - INTERVAL 30 DAY`,
        [],
        0
      ),
      // Conversão: cliques / visualizações (evita divisão por zero)
      (async () => {
        try {
          const clicks = await query(
            `SELECT COUNT(*) AS count FROM analytics WHERE event IN ('promo_click','coupon_copy') AND timestamp >= NOW() - INTERVAL 30 DAY`
          );
          const views = await query(
            `SELECT COUNT(*) AS count FROM analytics WHERE event IN ('promo_view','coupon_view') AND timestamp >= NOW() - INTERVAL 30 DAY`
          );
          const c = clicks[0]?.count || 0;
          const v = views[0]?.count || 0;
          const rate = v > 0 ? Math.round((c / v) * 100) : 0;
          return [{ rate }];
        } catch (e) {
          return [{ rate: 0 }];
        }
      })()
    ]);

    const summary = {
      products: {
        total: Number(productCounts[0]?.total || 0),
        published: Number(productCounts[0]?.published || 0),
        draft: Number(productCounts[0]?.draft || 0)
      },
      categories: { total: Number(categoryTotal[0]?.total || 0) },
      stores: { total: Number(storeTotal[0]?.total || 0) },
      blog: {
        total: Number(blogCounts[0]?.total || 0),
        published: Number(blogCounts[0]?.published || 0)
      },
      visitors: { last_30d: Number(visitorsLast30d[0]?.count || 0) },
      conversions: { rate: Number(conversions[0]?.rate || 0) }
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getTopProducts = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);
    const metric = (req.query.metric || 'clicks').toString().toLowerCase();
    const column = metric === 'views' ? 'views_count' : 'clicks_count';

    const rows = await query(
      `SELECT id, title, ${column} AS metric_value FROM promotions ORDER BY ${column} DESC, created_at DESC LIMIT ${limit}`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getTopCoupons = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);

    const rows = await query(`
      SELECT 
        c.code,
        s.name as store_name,
        c.usage_count as clicks_count
      FROM coupons c 
      JOIN stores s ON c.store_id = s.id 
      WHERE c.status = 'active' 
      ORDER BY c.usage_count DESC, c.created_at DESC 
      LIMIT ${limit}
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getTopCategoriesWithMetrics = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);

    const rows = await query(`
      SELECT 
        c.name,
        COUNT(p.id) as access_count
      FROM categories c
      LEFT JOIN promotion_categories pc ON c.id = pc.category_id
      LEFT JOIN promotions p ON pc.promotion_id = p.id AND p.status = 'published'
      WHERE c.status = 'active'
      GROUP BY c.id, c.name
      ORDER BY access_count DESC, c.name ASC
      LIMIT ${limit}
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getVisitsLast14Days = async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT 
        DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL (a.a + (10 * b.a)) DAY), '%d') as day,
        COALESCE(v.visits, 0) as visits
      FROM (
        SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
      ) as a
      CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1) as b
      LEFT JOIN (
        SELECT 
          DATE(timestamp) as visit_date,
          COUNT(DISTINCT session_id) as visits
        FROM analytics 
        WHERE event = 'page_view' 
          AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
          AND timestamp < CURDATE() + INTERVAL 1 DAY
        GROUP BY DATE(timestamp)
      ) v ON DATE_SUB(CURDATE(), INTERVAL (a.a + (10 * b.a)) DAY) = v.visit_date
      WHERE (a.a + (10 * b.a)) < 14
      ORDER BY (a.a + (10 * b.a)) ASC
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getCategoryPerformance = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);

    const rows = await query(`
      SELECT 
        c.name as category,
        c.clicks_count as clicks
      FROM categories c
      WHERE c.status = 'active' AND c.clicks_count > 0
      ORDER BY c.clicks_count DESC, c.name ASC
      LIMIT ${limit}
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const getStoreDistribution = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);

    const rows = await query(`
      SELECT 
        s.name as store,
        s.clicks_count as clicks
      FROM stores s
      WHERE s.status = 'active' AND s.clicks_count > 0
      ORDER BY s.clicks_count DESC, s.name ASC
      LIMIT ${limit}
    `);

    // Adicionar cores para o gráfico de pizza
    const colors = ['#FF6B35', '#0066CC', '#E31837', '#EE4D2D', '#8B5A96', '#28A745', '#FFC107', '#6F42C1', '#20C997', '#FD7E14'];
    const dataWithColors = rows.map((row, index) => ({
      ...row,
      color: colors[index % colors.length]
    }));

    res.json({ success: true, data: dataWithColors });
  } catch (error) {
    next(error);
  }
};

export const getRecentActivity = async (req, res, next) => {
  try {
    const [recentProducts, recentCoupons, recentPosts] = await Promise.all([
      // Produtos recentes
      query(`
        SELECT title as name, created_at 
        FROM promotions 
        ORDER BY created_at DESC 
        LIMIT 3
      `),
      // Cupons recentes
      query(`
        SELECT c.code, s.name as store_name, c.created_at 
        FROM coupons c 
        JOIN stores s ON c.store_id = s.id 
        ORDER BY c.created_at DESC 
        LIMIT 3
      `),
      // Posts recentes
      query(`
        SELECT title, created_at 
        FROM blog_posts 
        ORDER BY created_at DESC 
        LIMIT 3
      `).catch(() => []) // Se tabela blog_posts não existir
    ]);

    // Formatar datas para exibição
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Hoje';
      if (diffDays === 2) return 'Ontem';
      return `Há ${diffDays - 1} dias`;
    };

    const formattedProducts = recentProducts.map(p => ({
      name: p.name,
      date: formatDate(p.created_at)
    }));

    const formattedCoupons = recentCoupons.map(c => ({
      code: c.code,
      store: c.store_name,
      date: formatDate(c.created_at)
    }));

    const formattedPosts = recentPosts.map(p => ({
      title: p.title,
      date: formatDate(p.created_at)
    }));

    res.json({ 
      success: true, 
      data: {
        products: formattedProducts,
        coupons: formattedCoupons,
        posts: formattedPosts
      }
    });
  } catch (error) {
    next(error);
  }
}; 