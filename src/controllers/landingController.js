// Controller da aba "Landing Page" do admin (/admin/landing-page).
//
// Os grupos de destino do botão da LP (/geek-grupo) são cuidados pelo serviço
// geekauto-whatsapp (porta 3011, só em 127.0.0.1), em lp-groups.json, separados da
// captação. Aqui só há proxy autenticado, mais a leitura direta do arquivo para o painel
// abrir mesmo com o serviço fora do ar.

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.GEEKAUTO_DATA_DIR || '/root/Geekloko/geekpromo-auto/data';
const LP_FILE = path.join(DATA_DIR, 'lp-groups.json');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const SERVICE_URL = process.env.GEEKAUTO_WHATSAPP_URL || 'http://127.0.0.1:3011';

const ID_RE = /^[\w-]{3,64}$/;
const JID_RE = /^[\w-]{3,64}@g\.us$/;
const JOB_ID_RE = /^\d{1,20}$/;

async function proxy(res, method, pathname, body) {
  try {
    const upstream = await fetch(`${SERVICE_URL}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await upstream.json().catch(() => null);
    return res.status(upstream.status).json(json || { success: false, error: 'sem resposta do serviço' });
  } catch {
    return res.status(502).json({ success: false, error: 'serviço do WhatsApp indisponível' });
  }
}

const withId = (handler) => (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'identificador inválido' });
  return handler(req, res);
};

const who = (req) => req.admin?.email || 'admin';

// Com o serviço fora, devolve o último estado salvo, marcado como offline.
export const getState = async (req, res) => {
  try {
    const upstream = await fetch(`${SERVICE_URL}/lp`, { signal: AbortSignal.timeout(5000) });
    const json = await upstream.json();
    return res.status(upstream.status).json(json);
  } catch {
    try {
      const saved = JSON.parse(fs.readFileSync(LP_FILE, 'utf8'));
      return res.json({ success: true, data: { ...saved, offline: true } });
    } catch {
      return res.json({ success: true, data: { enabled: false, mode: 'auto', groups: [], offline: true } });
    }
  }
};

export const validate = (req, res) => {
  const { input } = req.body || {};
  if (!input || typeof input !== 'string' || input.length > 300) {
    return res.status(400).json({ success: false, error: 'cole o link do grupo' });
  }
  return proxy(res, 'POST', '/lp/validate', { input });
};

export const getJob = (req, res) => {
  if (!JOB_ID_RE.test(req.params.id)) return res.status(400).json({ success: false, error: 'id inválido' });
  return proxy(res, 'GET', `/jobs/${req.params.id}`);
};

export const join = (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') return res.status(400).json({ success: false, error: 'valide o link antes' });
  console.log(`[LP] entrada em grupo pedida por ${who(req)}`);
  return proxy(res, 'POST', '/lp/join', { code });
};

export const setEnabled = (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled deve ser boolean' });
  console.log(`[LP] rotação → ${enabled} por ${who(req)}`);
  return proxy(res, 'PUT', '/lp/enabled', { enabled });
};

export const setMode = (req, res) => {
  const { mode, jid } = req.body || {};
  if (!['auto', 'manual'].includes(mode)) return res.status(400).json({ success: false, error: 'modo inválido' });
  if (mode === 'manual' && !JID_RE.test(String(jid || ''))) {
    return res.status(400).json({ success: false, error: 'grupo inválido' });
  }
  console.log(`[LP] modo → ${mode}${mode === 'manual' ? ` (${jid})` : ''} por ${who(req)}`);
  return proxy(res, 'PUT', '/lp/mode', { mode, jid });
};

export const setOrder = (req, res) => {
  const { jids } = req.body || {};
  if (!Array.isArray(jids) || jids.length > 100 || !jids.every((j) => JID_RE.test(String(j)))) {
    return res.status(400).json({ success: false, error: 'ordem inválida' });
  }
  return proxy(res, 'PUT', '/lp/order', { jids });
};

export const relink = withId((req, res) => {
  const { input } = req.body || {};
  if (!input || typeof input !== 'string' || input.length > 300) {
    return res.status(400).json({ success: false, error: 'cole o link novo' });
  }
  return proxy(res, 'POST', `/lp/groups/${req.params.id}/relink`, { input });
});

export const remove = withId((req, res) => {
  console.log(`[LP] remoção do grupo ${req.params.id} pedida por ${who(req)}`);
  return proxy(res, 'DELETE', `/lp/groups/${req.params.id}`);
});

export const getStats = (req, res) => {
  const id = req.query.id ? String(req.query.id) : '';
  if (id && !ID_RE.test(id)) return res.status(400).json({ success: false, error: 'identificador inválido' });
  return proxy(res, 'GET', `/lp/stats${id ? `?id=${id}` : ''}`);
};

export const getEvents = (req, res) => {
  const params = new URLSearchParams();
  const { id, types, limit, before } = req.query;
  if (id) {
    if (!ID_RE.test(String(id))) return res.status(400).json({ success: false, error: 'identificador inválido' });
    params.set('id', String(id));
  }
  if (types) {
    const list = String(types).split(',').filter((t) => ['join', 'leave', 'click', 'rotation', 'mode', 'system'].includes(t));
    if (list.length) params.set('types', list.join(','));
  }
  if (limit) params.set('limit', String(Math.min(Number(limit) || 100, 500)));
  if (before && !Number.isNaN(Date.parse(String(before)))) params.set('before', String(before));
  const qs = params.toString();
  return proxy(res, 'GET', `/lp/events${qs ? `?${qs}` : ''}`);
};

export const getAvatar = withId((req, res) => {
  const file = path.join(AVATARS_DIR, `lp_${req.params.id}.jpg`);
  if (!fs.existsSync(file)) return res.status(404).send('sem foto');
  res.set('Cache-Control', 'private, max-age=60');
  return res.sendFile(file);
});
