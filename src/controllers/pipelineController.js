// Controller do pipeline do geekpromo-auto. Serve para o painel admin
// ligar/desligar o worker, mudar entre dry-run/live e ler logs/estado.
//
// Não expõe nada além do que o admin já autenticado pode ver ou fazer:
// tudo aqui é protegido por requireAdmin no roteador.
//
// A comunicação com o worker é 100% por arquivos em disco no mesmo host
// (o worker roda em /root/Geekloko/geekpromo-auto/). Não abre nenhuma
// porta nova, não faz chamada de rede.

import fs from 'node:fs';
import path from 'node:path';

// Caminho absoluto pro data/ do geekpromo-auto. Fica fora deste repo.
const DATA_DIR = process.env.GEEKAUTO_DATA_DIR || '/root/Geekloko/geekpromo-auto/data';

const P = {
  lock: path.join(DATA_DIR, 'pipeline.lock'),
  mode: path.join(DATA_DIR, 'pipeline.mode'),
  stats: path.join(DATA_DIR, 'stats.json'),
  circuit: path.join(DATA_DIR, 'circuit.json'),
  failed: path.join(DATA_DIR, 'failed.jsonl'),
  dryRun: path.join(DATA_DIR, 'dry-run.jsonl'),
  published: path.join(DATA_DIR, 'published.json'),
  dedupSkipped: path.join(DATA_DIR, 'dedup-skipped.jsonl'),
  recentPublished: path.join(DATA_DIR, 'recent-published.jsonl'),
  // Presença deste arquivo desliga o post no Telegram, mesmo com POST_TO_TELEGRAM=true.
  // Toggle provisório do admin — override em runtime, sem alterar env.
  telegramOff: path.join(DATA_DIR, 'telegram.disabled'),
  // Allowlist de categorias autorizadas a virar post. Ver getCategoriesPublish.
  categoriesPublish: path.join(DATA_DIR, 'categories-publish.json'),
  // Janelas de deduplicação (horas) — lido em runtime por dedup.js/coupon-flow.js.
  dedupConfig: path.join(DATA_DIR, 'dedup-config.json'),
  // Fontes do relatório "Fluxo de Mensagens" (últimos 7 dias).
  messages: path.join(DATA_DIR, 'messages.jsonl'),        // tudo que CHEGOU dos canais
  skipsDetail: path.join(DATA_DIR, 'skips-detail.jsonl'),  // barradas/puladas/duplicadas c/ motivo
  couponsSkipped: path.join(DATA_DIR, 'coupons-skipped.jsonl'), // dedup de cupom
  couponsRecent: path.join(DATA_DIR, 'coupons-recent.jsonl'),   // cupons PUBLICADOS
  scheduled: path.join(DATA_DIR, 'scheduled-publish.jsonl'), // fila viva do dispatcher
  imagesDir: path.join(DATA_DIR, 'images'),               // fotos cruas do Telegram
};

function safeReadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function tailLines(p, limit) {
  try {
    const text = fs.readFileSync(p, 'utf8').trim();
    if (!text) return [];
    const lines = text.split('\n');
    return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  } catch { return []; }
}

// GET /api/admin/pipeline/status
export const getStatus = (req, res) => {
  const enabled = fs.existsSync(P.lock);
  let mode = 'off';
  if (enabled) {
    try { mode = fs.readFileSync(P.mode, 'utf8').trim() === 'live' ? 'live' : 'dry-run'; }
    catch { mode = 'dry-run'; }
  }
  const stats = safeReadJson(P.stats, { day: new Date().toISOString().slice(0, 10), processed: 0, published: 0, skipped: 0, blocked: 0, failed: 0, ai_tokens_in: 0, ai_tokens_out: 0 });
  const circuit = safeReadJson(P.circuit, { fails: 0, openedAt: null });
  const publishedCount = Object.keys(safeReadJson(P.published, {})).length;
  const telegram_enabled = !fs.existsSync(P.telegramOff);

  return res.json({
    success: true,
    data: { enabled, mode, stats, circuit, published_total: publishedCount, telegram_enabled },
  });
};

// POST /api/admin/pipeline/telegram  { enabled: bool }
// Ativa/desativa o post no Telegram em runtime.
// Cria/remove o flag data/telegram.disabled — o worker olha por mensagem.
export const setTelegramEnabled = (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'enabled deve ser boolean' });
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (enabled) {
      if (fs.existsSync(P.telegramOff)) fs.unlinkSync(P.telegramOff);
    } else {
      fs.writeFileSync(P.telegramOff, '');
    }
    console.log(`[PIPELINE] telegram=${enabled ? 'ON' : 'OFF'} por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: { telegram_enabled: enabled } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/pipeline/start
// Cria pipeline.lock (sempre reseta modo para dry-run).
export const start = (req, res) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(P.lock, '');
    fs.writeFileSync(P.mode, 'dry-run\n');
    console.log(`[PIPELINE] START solicitado por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: { enabled: true, mode: 'dry-run' } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/pipeline/stop
export const stop = (req, res) => {
  try {
    if (fs.existsSync(P.lock)) fs.unlinkSync(P.lock);
    console.log(`[PIPELINE] STOP solicitado por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: { enabled: false } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/pipeline/mode  { mode: "dry-run"|"live" }
export const setMode = (req, res) => {
  const { mode } = req.body || {};
  if (!['dry-run', 'live'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'mode deve ser "dry-run" ou "live"' });
  }
  if (!fs.existsSync(P.lock)) {
    return res.status(400).json({ success: false, error: 'pipeline está desligado — use /start antes' });
  }
  try {
    fs.writeFileSync(P.mode, mode + '\n');
    console.log(`[PIPELINE] modo=${mode} por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: { mode } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/pipeline/dry-run?limit=20
export const dryRunLog = (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 20);
  return res.json({ success: true, data: tailLines(P.dryRun, limit) });
};

// GET /api/admin/pipeline/failed?limit=20
export const failedLog = (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 20);
  return res.json({ success: true, data: tailLines(P.failed, limit) });
};

// GET /api/admin/pipeline/dedup-skipped?limit=20
export const dedupSkippedLog = (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 20);
  return res.json({ success: true, data: tailLines(P.dedupSkipped, limit) });
};

// GET /api/admin/pipeline/categories-publish
// Retorna o mapa persistido em disco. Cria default (tudo desligado, on_unknown=skip)
// se o arquivo ainda não existe.
export const getCategoriesPublish = (req, res) => {
  const cfg = safeReadJson(P.categoriesPublish, {
    mode: 'allowlist',
    on_unknown_category: 'skip',
    categories: {},
    updated_at: null,
  });
  return res.json({ success: true, data: cfg });
};

// PUT /api/admin/pipeline/categories-publish
// Body: { categories: { [uuid]: boolean }, on_unknown_category?: 'skip'|'allow' }
// Sobrescreve o arquivo inteiro. Só aceita mapa uuid→bool.
export const setCategoriesPublish = (req, res) => {
  const body = req.body || {};
  const raw = body.categories;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return res.status(400).json({ success: false, error: 'categories deve ser objeto { uuid: boolean }' });
  }
  const clean = {};
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const [k, v] of Object.entries(raw)) {
    if (!UUID_RE.test(k)) continue;
    clean[k] = !!v;
  }
  const on_unknown = body.on_unknown_category === 'allow' ? 'allow' : 'skip';
  const payload = {
    mode: 'allowlist',
    on_unknown_category: on_unknown,
    categories: clean,
    updated_at: new Date().toISOString(),
    updated_by: req.admin?.email || null,
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(P.categoriesPublish, JSON.stringify(payload, null, 2));
    const on = Object.values(clean).filter(Boolean).length;
    console.log(`[PIPELINE] categories-publish salvo: ${on}/${Object.keys(clean).length} ativas por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: payload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Janelas de deduplicação (em horas), editáveis pelo painel.
//   product_window_hours → dedup de produtos  (pipeline/dedup.js)
//   coupon_window_hours  → dedup de cupons    (pipeline/coupon-flow.js)
// Os workers leem o mesmo arquivo em runtime (cache por mtime), então salvar
// aqui vale em segundos, sem restart.
// ---------------------------------------------------------------------------
const DEDUP_DEFAULTS = { product_window_hours: 4, coupon_window_hours: 1 };

function readDedupConfig() {
  const cfg = safeReadJson(P.dedupConfig, {});
  const p = Number(cfg.product_window_hours);
  const c = Number(cfg.coupon_window_hours);
  return {
    product_window_hours: Number.isFinite(p) && p > 0 ? p : DEDUP_DEFAULTS.product_window_hours,
    coupon_window_hours: Number.isFinite(c) && c > 0 ? c : DEDUP_DEFAULTS.coupon_window_hours,
    updated_at: cfg.updated_at || null,
    updated_by: cfg.updated_by || null,
  };
}

// GET /api/admin/pipeline/dedup-config
export const getDedupConfig = (req, res) => {
  return res.json({ success: true, data: readDedupConfig() });
};

// PUT /api/admin/pipeline/dedup-config
// Body: { product_window_hours: number, coupon_window_hours: number }
// Só aceita números positivos; clampa em [1, 168] horas (1h a 7 dias) e
// arredonda para hora inteira. Campo ausente/ inválido mantém o valor atual.
export const setDedupConfig = (req, res) => {
  const body = req.body || {};
  const current = readDedupConfig();
  const clamp = (v, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(168, Math.max(1, Math.round(n)));
  };
  const payload = {
    product_window_hours: clamp(body.product_window_hours, current.product_window_hours),
    coupon_window_hours: clamp(body.coupon_window_hours, current.coupon_window_hours),
    updated_at: new Date().toISOString(),
    updated_by: req.admin?.email || null,
  };
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(P.dedupConfig, JSON.stringify(payload, null, 2));
    console.log(`[PIPELINE] dedup-config salvo: produtos=${payload.product_window_hours}h cupons=${payload.coupon_window_hours}h por ${req.admin?.email || 'admin'}`);
    return res.json({ success: true, data: payload });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/pipeline/dedup-active
// Retorna quantas entradas ativas há na janela de produtos (count + tail curto)
export const dedupActive = (req, res) => {
  const now = Date.now();
  const WINDOW = readDedupConfig().product_window_hours * 3600 * 1000;
  const all = tailLines(P.recentPublished, 2000);
  const active = all.filter((e) => {
    const at = new Date(e.at || 0).getTime();
    return isFinite(at) && now - at < WINDOW;
  });
  return res.json({
    success: true,
    data: {
      active_count: active.length,
      last: active.slice(-20).reverse(),
    },
  });
};

// ---------------------------------------------------------------------------
// Relatório "Fluxo de Mensagens" — últimos 7 dias (corte rígido).
// Cruza tudo que CHEGOU (messages.jsonl) com o destino de cada mensagem:
// publicada, na fila, barrada por categoria, duplicada, ou pulada.
// Read-only, atrás de requireAdmin. Ver getMessageFlow / getMessageImage.
// ---------------------------------------------------------------------------

const FLOW_WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 dias — nada além disso é exposto.
const FLOW_CACHE_TTL_MS = 30 * 1000;         // rebuild no máx. a cada 30s.
let _flowCache = { builtAt: 0, items: null };

// Lê um .jsonl inteiro e devolve só os objetos cujo timestamp >= cutoff.
function readJsonlSince(filePath, cutoffMs, tsFields) {
  const out = [];
  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    let t = 0;
    for (const f of tsFields) {
      if (o[f]) { const p = Date.parse(o[f]); if (isFinite(p)) { t = p; break; } }
    }
    if (t >= cutoffMs) { o.__t = t; out.push(o); }
  }
  return out;
}

// Data no fuso BRT (GMT-3) no formato YYYY-MM-DD — pro histograma bater com
// o "dia" que o usuário/cliente enxerga.
function brtDay(ms) { return new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 10); }
// Chave/rótulo por HORA no fuso BRT (pra janelas curtas o histograma vira por hora).
function brtHourKey(ms) { return new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 13); } // YYYY-MM-DDTHH

// Mapa layer do skip → bucket de status do relatório.
function statusFromSkipLayer(layer) {
  if (layer === 'category-gate') return 'barrada_categoria';
  if (layer === 'dedup') return 'duplicada';
  return 'pulada'; // ia-guard, awin-flow, cross-store, coupon-*, shopee-link-guard, processor, ai, partner_url, ssrf, payload...
}

const FLOW_STATUS_LABEL = {
  publicada: 'Publicada',
  na_fila: 'Na fila',
  barrada_categoria: 'Barrada (categoria)',
  duplicada: 'Duplicada',
  pulada: 'Pulada',
  recebida: 'Recebida (sem desfecho)',
};

function buildFlowDataset() {
  const cutoff = Date.now() - FLOW_WINDOW_MS;

  // Índices de desfecho por mensagem.
  const published = new Map();  // messageId -> {title, loja, at}
  for (const p of readJsonlSince(P.recentPublished, cutoff, ['at'])) {
    if (p.messageId != null) published.set(String(p.messageId), p);
  }
  // Cupons publicados vão para outro arquivo — também contam como "publicada".
  for (const c of readJsonlSince(P.couponsRecent, cutoff, ['at'])) {
    if (c.messageId != null && !published.has(String(c.messageId))) published.set(String(c.messageId), c);
  }
  const queued = new Map();     // messageId -> payload (fila viva; sem corte de data)
  for (const q of readJsonlSince(P.scheduled, 0, ['enqueuedAt', 'readyAt'])) {
    if (q.messageId != null) queued.set(String(q.messageId), q);
  }
  const skips = new Map();      // messageId -> registro de skip (último vence)
  for (const s of readJsonlSince(P.skipsDetail, cutoff, ['at', 'date'])) {
    if (s.messageId != null) skips.set(String(s.messageId), s);
  }
  const couponDup = new Map();  // messageId -> registro de dedup de cupom
  for (const c of readJsonlSince(P.couponsSkipped, cutoff, ['at'])) {
    if (c.messageId != null) couponDup.set(String(c.messageId), c);
  }

  // Universo = tudo que chegou nos últimos 7 dias.
  const items = [];
  for (const m of readJsonlSince(P.messages, cutoff, ['date'])) {
    const mid = String(m.messageId);
    let status, title = null, loja = null;

    if (published.has(mid)) {
      const p = published.get(mid); status = 'publicada'; title = p.title || null; loja = p.loja || null;
    } else if (queued.has(mid)) {
      const q = queued.get(mid); status = 'na_fila'; title = q.payload?.title || null;
    } else if (skips.has(mid)) {
      const s = skips.get(mid);
      status = statusFromSkipLayer(s.layer);
      title = s.ia?.extracted?.titulo || s.candidate?.titulo || null;
      loja = s.ia?.extracted?.loja || null;
    } else if (couponDup.has(mid)) {
      status = 'duplicada'; loja = couponDup.get(mid).loja || null;
    } else {
      status = 'recebida';
    }

    const text = (m.text || '').replace(/\s+/g, ' ').trim();
    const imgBase = m.imageUrl ? m.imageUrl.split('/').pop() : null;
    items.push({
      ts: m.date,
      __t: m.__t,
      status,
      title,
      body: text.slice(0, 180),
      group: m.groupLabel || m.groupUsername || '',
      loja,
      img: imgBase && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(imgBase) ? imgBase : null,
      _s: `${title || ''} ${text} ${m.groupLabel || ''}`.toLowerCase(),
    });
  }

  items.sort((a, b) => b.__t - a.__t);
  return items;
}

function getFlowItems() {
  if (!_flowCache.items || Date.now() - _flowCache.builtAt > FLOW_CACHE_TTL_MS) {
    _flowCache = { builtAt: Date.now(), items: buildFlowDataset() };
  }
  return _flowCache.items;
}

// GET /api/admin/pipeline/message-flow?page=1&pageSize=25&status=&q=&from=&to=
// KPIs + histograma + lista, tudo restrito à janela [from, to] (se enviadas),
// sempre dentro do corte rígido de 7 dias. from/to em ISO (UTC).
export const getMessageFlow = (req, res) => {
  try {
    const all = getFlowItems();

    // Recorte por intervalo (início/fim). Sempre limitado aos últimos 7 dias.
    const fromMs = Date.parse(req.query.from) || null;
    const toMs = Date.parse(req.query.to) || null;
    let scoped = all;
    if (fromMs) scoped = scoped.filter((it) => it.__t >= fromMs);
    if (toMs) scoped = scoped.filter((it) => it.__t <= toMs);

    // KPIs sobre o intervalo selecionado (ou 7d se não filtrou).
    const kpis = { total: scoped.length, publicada: 0, na_fila: 0, barrada_categoria: 0, duplicada: 0, pulada: 0, recebida: 0 };

    // Granularidade do gráfico: por HORA quando a janela é curta (≤ 2 dias),
    // senão por DIA. Assim "09h–11h" aparece quebrado por hora.
    let spanMs;
    if (fromMs && toMs) spanMs = toMs - fromMs;
    else if (scoped.length) spanMs = scoped[0].__t - scoped[scoped.length - 1].__t; // ordenado desc
    else spanMs = 0;
    const hourly = spanMs > 0 && spanMs <= 2 * 24 * 3600 * 1000;

    const buckets = new Map();
    for (const it of scoped) {
      kpis[it.status] = (kpis[it.status] || 0) + 1;
      const key = hourly ? brtHourKey(it.__t) : brtDay(it.__t);
      if (!buckets.has(key)) {
        const label = hourly ? `${key.slice(8, 10)}/${key.slice(5, 7)} ${key.slice(11, 13)}h`
                             : `${key.slice(8, 10)}/${key.slice(5, 7)}`;
        buckets.set(key, { key, label, total: 0, publicada: 0, barrada_categoria: 0, duplicada: 0, pulada: 0 });
      }
      const b = buckets.get(key);
      b.total += 1;
      if (b[it.status] != null) b[it.status] += 1;
    }
    const histogram = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));

    // Filtro (status/busca) + paginação da lista, sobre o intervalo.
    const status = (req.query.status || '').toString();
    const q = (req.query.q || '').toString().trim().toLowerCase();
    let filtered = scoped;
    if (status && FLOW_STATUS_LABEL[status]) filtered = filtered.filter((it) => it.status === status);
    if (q) filtered = filtered.filter((it) => it._s.includes(q));

    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize).map((it) => ({
      ts: it.ts, status: it.status, status_label: FLOW_STATUS_LABEL[it.status],
      title: it.title, body: it.body, group: it.group, loja: it.loja, img: it.img,
    }));

    return res.json({
      success: true,
      data: {
        window_days: 7,
        generated_at: new Date().toISOString(),
        range: { from: fromMs ? new Date(fromMs).toISOString() : null, to: toMs ? new Date(toMs).toISOString() : null },
        histogram_granularity: hourly ? 'hour' : 'day',
        kpis,
        status_labels: FLOW_STATUS_LABEL,
        histogram,
        list: { page, pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)), rows },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/pipeline/message-image?file=<basename>
// Faz stream da foto crua do Telegram (data/images). Protegido por requireAdmin.
// Só aceita basename simples — barra path traversal.
export const getMessageImage = (req, res) => {
  const file = (req.query.file || '').toString();
  if (!/^[\w.-]+\.(jpe?g|png|webp)$/i.test(file) || file.includes('..')) {
    return res.status(400).json({ success: false, error: 'nome de arquivo inválido' });
  }
  const full = path.join(P.imagesDir, file);
  if (!full.startsWith(P.imagesDir) || !fs.existsSync(full)) {
    return res.status(404).json({ success: false, error: 'imagem não encontrada' });
  }
  const ext = path.extname(full).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(full).on('error', () => { if (!res.headersSent) res.status(404).end(); }).pipe(res);
};
