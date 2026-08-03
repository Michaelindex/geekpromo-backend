import crypto from 'node:crypto';
import { query } from '../config/database.js';

// Encurtador próprio na RAIZ do domínio: geekpromo.com.br/{code}
//
// Distinto do `shortUrlController.js`, que cuida das URLs curtas de PRODUTO
// servidas em /p/ e /go/ (tabela product_short_urls, ~40 mil registros).
// Aqui é tabela separada (`short_links`) e namespace separado (raiz), de
// propósito: nada deste arquivo pode afetar aquele fluxo.

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://geekpromo.com.br';

// Alfabeto do código: minúsculas + dígitos (36^4 = 1.679.616 combinações).
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 4;
const MAX_GENERATION_ATTEMPTS = 12;

// Códigos que NUNCA podem ser gerados porque colidiriam com uma rota real do
// site na raiz. Levantamento feito contra as rotas do React (App.tsx), os
// proxies do https-server.js e os arquivos de dist/: no comprimento 4 só
// "blog" colide de fato. Os demais entram como margem de segurança para o
// caso de alguém criar uma rota curta no futuro.
const RESERVED_CODES = new Set([
  'blog', 'apis', 'auth', 'admn', 'home', 'shop', 'loja', 'cart', 'user',
  'help', 'sobre', 'null', 'true', 'false', 'test',
].filter((c) => c.length === CODE_LENGTH));

function generateCandidateCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Gera um código único de 4 caracteres.
 * A garantia real de unicidade é o índice UNIQUE em `short_links.code` — a
 * checagem prévia só evita a maioria das tentativas perdidas. Em caso de
 * corrida (ER_DUP_ENTRY no INSERT), o caller tenta de novo.
 */
export async function generateUniqueCode() {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = generateCandidateCode();
    if (RESERVED_CODES.has(candidate)) continue;
    const existing = await query('SELECT id FROM short_links WHERE code = ? LIMIT 1', [candidate]);
    if (existing.length === 0) return candidate;
  }
  throw new Error('Não foi possível gerar um código curto único');
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Criar link curto
 * POST /api/short-links   { target_url, source?, brand?, ref? }
 */
export const createShortLink = async (req, res, next) => {
  try {
    const { target_url, source = null, brand = null, ref = null } = req.body || {};

    if (!target_url || !isValidHttpUrl(target_url)) {
      return res.status(400).json({
        success: false,
        error: 'target_url é obrigatório e precisa ser uma URL http(s) válida'
      });
    }

    // Reaproveita o mesmo código quando o destino já foi encurtado com a
    // mesma origem — evita encher a tabela com duplicatas do mesmo link.
    const existing = await query(
      'SELECT code FROM short_links WHERE target_url = ? AND is_active = 1 LIMIT 1',
      [target_url]
    );
    if (existing.length > 0) {
      return res.json({
        success: true,
        data: {
          code: existing[0].code,
          short_url: `${PUBLIC_BASE_URL}/${existing[0].code}`,
          reused: true
        }
      });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = await generateUniqueCode();
      try {
        await query(
          'INSERT INTO short_links (code, target_url, source, brand, ref) VALUES (?, ?, ?, ?, ?)',
          [code, target_url, source, brand, ref]
        );
        return res.status(201).json({
          success: true,
          data: { code, short_url: `${PUBLIC_BASE_URL}/${code}`, reused: false }
        });
      } catch (err) {
        // Corrida: outro request pegou o mesmo código entre o SELECT e o
        // INSERT. Tenta de novo com um código diferente.
        if (err && err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Não foi possível gerar um código curto único'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolver link curto (consumido pelo https-server.js no redirect da raiz)
 * GET /api/short-links/resolve/:code
 *
 * Incrementa o contador de cliques. O incremento é best-effort: se falhar,
 * o redirect ainda acontece — perder uma métrica nunca pode custar um clique.
 */
export const resolveShortLink = async (req, res, next) => {
  try {
    const { code } = req.params;

    if (!code || !/^[a-z0-9]{1,16}$/i.test(code)) {
      return res.status(404).json({ success: false, error: 'Código inválido' });
    }

    const rows = await query(
      'SELECT id, code, target_url FROM short_links WHERE code = ? AND is_active = 1 LIMIT 1',
      [code.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Código não encontrado' });
    }

    const link = rows[0];

    query(
      'UPDATE short_links SET clicks = clicks + 1, last_click_at = CURRENT_TIMESTAMP WHERE id = ?',
      [link.id]
    ).catch((err) => {
      console.error('⚠️ [SHORT-LINK] Falha ao contabilizar clique:', err.message);
    });

    return res.json({
      success: true,
      data: { code: link.code, target_url: link.target_url }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar links curtos (admin) — auditoria e métricas de clique
 * GET /api/short-links?limit=50&source=awin
 */
export const listShortLinks = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const { source } = req.query;

    const where = source ? 'WHERE source = ?' : '';
    const params = source ? [source] : [];

    const rows = await query(
      `SELECT id, code, target_url, source, brand, ref, clicks, last_click_at, is_active, created_at
       FROM short_links ${where}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
