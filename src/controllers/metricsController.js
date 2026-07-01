import { query } from '../config/database.js';

/**
 * Normaliza e valida datas recebidas via query string.
 * Aceita formato YYYY-MM-DD. Retorna { startDate, endDate } como strings.
 */
function resolveDateRange(req) {
  let { start_date: startDate, end_date: endDate } = req.query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    throw new Error('Parâmetro start_date inválido. Use formato YYYY-MM-DD.');
  }

  if (endDate && !dateRegex.test(endDate)) {
    throw new Error('Parâmetro end_date inválido. Use formato YYYY-MM-DD.');
  }

  // Se não vierem datas, usa últimos 7 dias como padrão
  if (!startDate || !endDate) {
    // Calcula datas em GMT-3 baseado no NOW() do MySQL para manter consistência
    // Aqui só montamos placeholders; a query usa DATE(DATE_SUB(NOW(), INTERVAL n DAY))
    return { startDate: null, endDate: null, useDefaultLast7Days: true };
  }

  return { startDate, endDate, useDefaultLast7Days: false };
}

/**
 * GET /api/admin/metrics/promotions/views
 * Query params:
 *  - start_date (YYYY-MM-DD) opcional
 *  - end_date   (YYYY-MM-DD) opcional
 *  - limit      (opcional, default 10)
 *
 * Retorna top promoções por views no intervalo informado, usando promotion_daily_metrics.
 */
export const getPromotionViewsMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate, useDefaultLast7Days } = resolveDateRange(req);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    let rows;
    let rangeInfo;

    let totalViewsQuery;
    let totalViewsParams;

    if (useDefaultLast7Days) {
      // Usa últimos 7 dias em GMT-3, baseado em NOW() UTC - 3h
      rows = await query(
        `
        SELECT 
          p.id AS promotion_id,
          p.title,
          SUM(pdm.views) AS views,
          MIN(pdm.metric_date) AS start_date,
          MAX(pdm.metric_date) AS end_date
        FROM promotion_daily_metrics pdm
        JOIN promotions p ON p.id = pdm.promotion_id
        WHERE pdm.metric_date BETWEEN DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY)
                                  AND DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
        GROUP BY p.id, p.title
        ORDER BY views DESC, MAX(p.created_at) DESC
        LIMIT ?
        `,
        [limit]
      );

      // Descobrir range efetivo usado
      const range = await query(
        `
        SELECT 
          DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY) AS start_date,
          DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)) AS end_date
        `
      );
      rangeInfo = range[0];

      // Calcular total geral do período (não apenas dos top produtos)
      totalViewsQuery = `
        SELECT COALESCE(SUM(views), 0) AS total_views
        FROM promotion_daily_metrics
        WHERE metric_date BETWEEN DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY)
                              AND DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
      `;
      totalViewsParams = [];
    } else {
      rows = await query(
        `
        SELECT 
          p.id AS promotion_id,
          p.title,
          SUM(pdm.views) AS views,
          MIN(pdm.metric_date) AS start_date,
          MAX(pdm.metric_date) AS end_date
        FROM promotion_daily_metrics pdm
        JOIN promotions p ON p.id = pdm.promotion_id
        WHERE pdm.metric_date BETWEEN ? AND ?
        GROUP BY p.id, p.title
        ORDER BY views DESC, MAX(p.created_at) DESC
        LIMIT ?
        `,
        [startDate, endDate, limit]
      );

      rangeInfo = { start_date: startDate, end_date: endDate };

      // Calcular total geral do período (não apenas dos top produtos)
      totalViewsQuery = `
        SELECT COALESCE(SUM(views), 0) AS total_views
        FROM promotion_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
      `;
      totalViewsParams = [startDate, endDate];
    }

    // Buscar total geral do período
    const totalViewsResult = await query(totalViewsQuery, totalViewsParams);
    const totalViewsRow = Number(totalViewsResult[0]?.total_views || 0);

    res.json({
      success: true,
      range: {
        start_date: rangeInfo.start_date,
        end_date: rangeInfo.end_date
      },
      total_views: totalViewsRow,
      items: rows.map((r) => ({
        promotion_id: r.promotion_id,
        title: r.title,
        views: Number(r.views || 0)
      }))
    });
  } catch (error) {
    if (error.message?.includes('Parâmetro')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/admin/metrics/coupons/copies
 * Query params:
 *  - start_date (YYYY-MM-DD) opcional
 *  - end_date   (YYYY-MM-DD) opcional
 *  - limit      (opcional, default 10)
 *
 * Retorna top cupons por cópias/cliques no intervalo informado, usando coupon_daily_metrics.
 */
export const getCouponCopiesMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate, useDefaultLast7Days } = resolveDateRange(req);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);

    let rows;
    let rangeInfo;

    let totalCopiesQuery;
    let totalCopiesParams;

    if (useDefaultLast7Days) {
      rows = await query(
        `
        SELECT 
          c.id AS coupon_id,
          c.code,
          s.name AS store_name,
          SUM(cdm.copies) AS copies,
          MIN(cdm.metric_date) AS start_date,
          MAX(cdm.metric_date) AS end_date
        FROM coupon_daily_metrics cdm
        JOIN coupons c ON c.id = cdm.coupon_id
        JOIN stores s ON s.id = c.store_id
        WHERE cdm.metric_date BETWEEN DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY)
                                  AND DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
        GROUP BY c.id, c.code, s.name
        ORDER BY copies DESC, MAX(c.created_at) DESC
        LIMIT ?
        `,
        [limit]
      );

      const range = await query(
        `
        SELECT 
          DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY) AS start_date,
          DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)) AS end_date
        `
      );
      rangeInfo = range[0];

      // Calcular total geral do período (não apenas dos top cupons)
      totalCopiesQuery = `
        SELECT COALESCE(SUM(copies), 0) AS total_copies
        FROM coupon_daily_metrics
        WHERE metric_date BETWEEN DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 6 DAY)
                              AND DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
      `;
      totalCopiesParams = [];
    } else {
      rows = await query(
        `
        SELECT 
          c.id AS coupon_id,
          c.code,
          s.name AS store_name,
          SUM(cdm.copies) AS copies,
          MIN(cdm.metric_date) AS start_date,
          MAX(cdm.metric_date) AS end_date
        FROM coupon_daily_metrics cdm
        JOIN coupons c ON c.id = cdm.coupon_id
        JOIN stores s ON s.id = c.store_id
        WHERE cdm.metric_date BETWEEN ? AND ?
        GROUP BY c.id, c.code, s.name
        ORDER BY copies DESC, MAX(c.created_at) DESC
        LIMIT ?
        `,
        [startDate, endDate, limit]
      );

      rangeInfo = { start_date: startDate, end_date: endDate };

      // Calcular total geral do período (não apenas dos top cupons)
      totalCopiesQuery = `
        SELECT COALESCE(SUM(copies), 0) AS total_copies
        FROM coupon_daily_metrics
        WHERE metric_date BETWEEN ? AND ?
      `;
      totalCopiesParams = [startDate, endDate];
    }

    // Buscar total geral do período
    const totalCopiesResult = await query(totalCopiesQuery, totalCopiesParams);
    const totalCopies = Number(totalCopiesResult[0]?.total_copies || 0);

    res.json({
      success: true,
      range: {
        start_date: rangeInfo.start_date,
        end_date: rangeInfo.end_date
      },
      total_copies: totalCopies,
      items: rows.map((r) => ({
        coupon_id: r.coupon_id,
        code: r.code,
        store_name: r.store_name,
        copies: Number(r.copies || 0)
      }))
    });
  } catch (error) {
    if (error.message?.includes('Parâmetro')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};


