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
  const stats = safeReadJson(P.stats, { day: new Date().toISOString().slice(0, 10), processed: 0, published: 0, skipped: 0, failed: 0, ai_tokens_in: 0, ai_tokens_out: 0 });
  const circuit = safeReadJson(P.circuit, { fails: 0, openedAt: null });
  const publishedCount = Object.keys(safeReadJson(P.published, {})).length;

  return res.json({
    success: true,
    data: { enabled, mode, stats, circuit, published_total: publishedCount },
  });
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

// GET /api/admin/pipeline/dedup-active
// Retorna quantas entradas ativas há na janela de 2h (só o count + tail curto)
export const dedupActive = (req, res) => {
  const now = Date.now();
  const WINDOW = 2 * 3600 * 1000;
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
