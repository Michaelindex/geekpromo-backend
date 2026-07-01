import { query } from '../config/database.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Configurações do cookie (via env ou defaults)
const COOKIE_NAME = process.env.VISITOR_COOKIE_NAME || 'gluid';
const COOKIE_MAX_DAYS = parseInt(process.env.VISITOR_COOKIE_MAX_DAYS || '365');
const HASH_SECRET = process.env.VISITOR_HASH_SECRET || 'change-this-secret-in-production';

/**
 * POST /api/visit
 * Registra uma visita única por dia
 * Usa cookie first-party para identificação anônima
 */
export const registerVisit = async (req, res, next) => {
  try {
    // 1. Ler ou criar identificador anônimo (cookie)
    let gluid = req.cookies[COOKIE_NAME];
    let isNewVisitor = false;
    
    if (!gluid) {
      // Gerar novo UUID v4 para este visitante
      gluid = uuidv4();
      isNewVisitor = true;
      
      console.log('🆕 [VISIT] Novo visitante detectado, gerando cookie:', gluid.substring(0, 8) + '...');
      
      // Configurar cookie first-party
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie(COOKIE_NAME, gluid, {
        maxAge: COOKIE_MAX_DAYS * 24 * 60 * 60 * 1000, // dias → milissegundos
        httpOnly: true,
        secure: isProduction, // HTTPS em produção
        sameSite: 'lax',
        path: '/'
      });
    } else {
      console.log('🔄 [VISIT] Visitante retornando, cookie:', gluid.substring(0, 8) + '...');
    }

    // 2. Calcular hash do visitante (irreversível)
    const visitor_hash = crypto
      .createHash('sha256')
      .update(HASH_SECRET + gluid)
      .digest('hex');

    console.log('🔐 [VISIT] Hash gerado:', visitor_hash.substring(0, 16) + '...');

    // 3. Registrar visita (INSERT IGNORE evita duplicatas no mesmo dia)
    // Usa timezone de Brasília (GMT-3) subtraindo 3 horas do UTC
    const result = await query(`
      INSERT IGNORE INTO daily_visits (visit_date, visitor_hash)
      VALUES (DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), ?)
    `, [visitor_hash]);

    // Verificar se foi inserido (affectedRows > 0) ou era duplicata (affectedRows = 0)
    const wasInserted = result.affectedRows > 0;
    
    if (wasInserted) {
      console.log('✅ [VISIT] Visita registrada com sucesso! (primeira do dia para este visitante)');
    } else {
      console.log('⏭️  [VISIT] Visita já registrada hoje (duplicata ignorada)');
    }

    // 4. Responder com sucesso (204 No Content)
    res.status(204).send();
  } catch (error) {
    console.error('❌ [VISIT] Erro ao registrar visita:', error);
    next(error);
  }
};

/**
 * GET /api/admin/visits?period={day|week|month|year}&{days|weeks|months|years}=N
 * Retorna série temporal de visitas conforme período solicitado
 */
export const getVisitStats = async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    console.log(`📊 [VISIT-STATS] Consultando estatísticas - Período: ${period}`, req.query);
    let results = [];

    switch (period) {
      case 'day': {
        const days = parseInt(req.query.days || '14');
        // Janela deslizante: últimos N dias INCLUINDO hoje (timezone Brasília GMT-3)
        // Ex: days=7 → retorna 7 dias (D-6, D-5, D-4, D-3, D-2, D-1, Hoje)
        // Preenche com zeros quando não há visitas
        // Ordem: ASC (mais antigo à esquerda → hoje à direita)
        results = await query(`
          SELECT 
            DATE_FORMAT(DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL (? - 1 - seq.n) DAY), '%Y-%m-%d') AS date,
            COALESCE(v.visits, 0) AS visits
          FROM (
            SELECT (a.a + 10*b.a + 100*c.a) AS n
            FROM (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                  SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
            CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
            CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
          ) AS seq
          LEFT JOIN (
            SELECT visit_date, COUNT(*) AS visits
            FROM daily_visits
            WHERE visit_date >= DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL (? - 1) DAY)
              AND visit_date <= DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
            GROUP BY visit_date
          ) v ON v.visit_date = DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL (? - 1 - seq.n) DAY)
          WHERE seq.n < ?
          ORDER BY seq.n ASC
        `, [days, days, days, days]);
        break;
      }

      case 'week': {
        const weeks = parseInt(req.query.weeks || '12');
        // Série contínua de semanas (ISO), preenchendo com 0
        results = await query(`
          SELECT 
            yw.week,
            COALESCE(v.visits, 0) AS visits,
            DATE_FORMAT(yw.week_start, '%Y-%m-%d') AS week_start,
            DATE_FORMAT(yw.week_end, '%Y-%m-%d') AS week_end
          FROM (
            SELECT 
              YEARWEEK(DATE_SUB(CURDATE(), INTERVAL seq.n WEEK), 1) AS week,
              DATE_SUB(STR_TO_DATE(CONCAT(YEARWEEK(DATE_SUB(CURDATE(), INTERVAL seq.n WEEK), 1), ' Monday'), '%X%V %W'), INTERVAL 0 DAY) AS week_start,
              DATE_SUB(STR_TO_DATE(CONCAT(YEARWEEK(DATE_SUB(CURDATE(), INTERVAL seq.n WEEK), 1), ' Sunday'), '%X%V %W'), INTERVAL 0 DAY) AS week_end
            FROM (
              SELECT (a.a + 10*b.a + 100*c.a) AS n
              FROM (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                    SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
              CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                          SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
              CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                          SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
            ) AS seq
            WHERE seq.n < ?
          ) AS yw
          LEFT JOIN (
            SELECT YEARWEEK(visit_date, 1) AS week, COUNT(*) AS visits
            FROM daily_visits
            WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL (? - 1) WEEK)
            GROUP BY YEARWEEK(visit_date, 1)
          ) v ON v.week = yw.week
          ORDER BY yw.week ASC
        `, [weeks, weeks]);
        break;
      }

      case 'month': {
        const months = parseInt(req.query.months || '12');
        // Janela deslizante: últimos N meses INCLUINDO mês atual (parcial) - timezone Brasília GMT-3
        // Ex: months=12 → retorna 12 meses (M-11, M-10, ... M-1, Mês Atual)
        // Preenche com zeros quando não há visitas
        // Ordem: ASC (mais antigo à esquerda → mês atual à direita)
        results = await query(`
          SELECT 
            DATE_FORMAT(DATE_SUB(DATE_FORMAT(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), '%Y-%m-01'), INTERVAL (? - 1 - seq.n) MONTH), '%Y-%m') AS month,
            COALESCE(v.visits, 0) AS visits
          FROM (
            SELECT (a.a + 10*b.a + 100*c.a) AS n
            FROM (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                  SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
            CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
            CROSS JOIN (SELECT 0 a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL 
                        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
          ) AS seq
          LEFT JOIN (
            SELECT DATE_FORMAT(visit_date, '%Y-%m') AS ym, COUNT(*) AS visits
            FROM daily_visits
            WHERE visit_date >= DATE_SUB(DATE_FORMAT(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), '%Y-%m-01'), INTERVAL (? - 1) MONTH)
              AND visit_date <= LAST_DAY(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)))
            GROUP BY DATE_FORMAT(visit_date, '%Y-%m')
          ) v ON v.ym = DATE_FORMAT(DATE_SUB(DATE_FORMAT(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), '%Y-%m-01'), INTERVAL (? - 1 - seq.n) MONTH), '%Y-%m')
          WHERE seq.n < ?
          ORDER BY seq.n ASC
        `, [months, months, months, months]);
        break;
      }

      case 'year': {
        const years = parseInt(req.query.years || '5');
        results = await query(`
          SELECT 
            YEAR(visit_date) AS year,
            COUNT(*) AS visits
          FROM daily_visits
          WHERE visit_date >= CURDATE() - INTERVAL ? YEAR
          GROUP BY YEAR(visit_date)
          ORDER BY year ASC
        `, [years]);
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Período inválido. Use: day, week, month ou year'
        });
    }

    // Converter BigInt para Number se necessário
    const formattedResults = results.map(row => {
      const formatted = {};
      for (const key in row) {
        formatted[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key];
      }
      return formatted;
    });

    res.json({
      success: true,
      period,
      data: formattedResults
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de visitas:', error);
    next(error);
  }
};

/**
 * GET /api/admin/visits/summary
 * Retorna resumo de visitas (hoje, semana, mês)
 */
export const getVisitSummary = async (req, res, next) => {
  try {
    const [today, last7days, last30days, total] = await Promise.all([
      // Hoje (timezone Brasília GMT-3)
      query(`
        SELECT COUNT(*) AS count
        FROM daily_visits
        WHERE visit_date = DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR))
      `),
      // Últimos 7 dias (timezone Brasília GMT-3)
      query(`
        SELECT COUNT(*) AS count
        FROM daily_visits
        WHERE visit_date >= DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 7 DAY)
      `),
      // Últimos 30 dias (timezone Brasília GMT-3)
      query(`
        SELECT COUNT(*) AS count
        FROM daily_visits
        WHERE visit_date >= DATE_SUB(DATE(DATE_SUB(NOW(), INTERVAL 3 HOUR)), INTERVAL 30 DAY)
      `),
      // Total
      query(`
        SELECT COUNT(*) AS count
        FROM daily_visits
      `)
    ]);

    res.json({
      success: true,
      data: {
        today: Number(today[0]?.count || 0),
        last_7_days: Number(last7days[0]?.count || 0),
        last_30_days: Number(last30days[0]?.count || 0),
        total: Number(total[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar resumo de visitas:', error);
    next(error);
  }
};

