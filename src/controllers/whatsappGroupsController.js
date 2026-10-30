// Controller dos grupos e canais do WhatsApp.
//
// O processo geekauto-whatsapp (porta 3011, só em 127.0.0.1) é o único que fala com o
// WhatsApp e o único que escreve em wa-groups.json. Aqui só há proxy autenticado, mais
// a leitura direta da lista para o painel continuar abrindo com o serviço fora do ar.

import fs from 'node:fs';
import path from 'node:path';
import { STORE_FILTER_KEYS } from './telegramGroupsController.js';

const DATA_DIR = process.env.GEEKAUTO_DATA_DIR || '/root/Geekloko/geekpromo-auto/data';
const GROUPS_FILE = path.join(DATA_DIR, 'wa-groups.json');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const SERVICE_URL = process.env.GEEKAUTO_WHATSAPP_URL || 'http://127.0.0.1:3011';

const USERNAME_RE = /^wa_[\w-]{3,64}$/;
const JOB_ID_RE = /^\d{1,20}$/;
const STORE_FILTER_KEY_SET = new Set(STORE_FILTER_KEYS);

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

const withUsername = (handler) => (req, res) => {
  if (!USERNAME_RE.test(req.params.username)) {
    return res.status(400).json({ success: false, error: 'identificador inválido' });
  }
  return handler(req, res);
};

export const getStatus = (req, res) => proxy(res, 'GET', '/status');

export const listGroups = (req, res) => {
  try {
    return res.json({ success: true, data: JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8')) });
  } catch {
    return res.json({ success: true, data: { updated_at: null, groups: [] } });
  }
};

export const pair = (req, res) => proxy(res, 'POST', '/pair', { force: req.body?.force === true });
export const resume = (req, res) => proxy(res, 'POST', '/resume', {});
export const pause = (req, res) => proxy(res, 'POST', '/pause', {});

export const setSink = (req, res) => {
  console.log(`[WA-GROUPS] destino → ${req.body?.sink} por ${req.admin?.email || 'admin'}`);
  return proxy(res, 'PUT', '/sink', { sink: req.body?.sink });
};

export const resolveGroup = (req, res) => {
  const { input } = req.body || {};
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ success: false, error: 'informe o link do grupo ou canal' });
  }
  return proxy(res, 'POST', '/resolve', { input });
};

export const getJob = (req, res) => {
  if (!JOB_ID_RE.test(req.params.id)) {
    return res.status(400).json({ success: false, error: 'id inválido' });
  }
  return proxy(res, 'GET', `/jobs/${req.params.id}`);
};

export const joinGroup = (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'valide o link antes' });
  }
  return proxy(res, 'POST', '/join', { code });
};

export const importGroups = (req, res) => proxy(res, 'POST', '/import', {});

export const toggleGroup = withUsername((req, res) => {
  const { active } = req.body || {};
  if (typeof active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'active deve ser boolean' });
  }
  console.log(`[WA-GROUPS] ${req.params.username} → ${active ? 'ATIVO' : 'INATIVO'} por ${req.admin?.email || 'admin'}`);
  return proxy(res, 'POST', `/groups/${req.params.username}/toggle`, { active });
});

// Mesmas chaves e mesma regra do filtro do Telegram.
export const updateStoreFilters = withUsername((req, res) => {
  const { storeFilters } = req.body || {};
  if (!storeFilters || typeof storeFilters !== 'object' || Array.isArray(storeFilters)) {
    return res.status(400).json({ success: false, error: 'storeFilters deve ser objeto' });
  }
  for (const [k, v] of Object.entries(storeFilters)) {
    if (!STORE_FILTER_KEY_SET.has(k) || typeof v !== 'boolean') {
      return res.status(400).json({ success: false, error: `valor inválido: ${k}` });
    }
  }
  return proxy(res, 'PUT', `/groups/${req.params.username}/store-filters`, { storeFilters });
});

export const refreshGroup = withUsername((req, res) => proxy(res, 'POST', `/groups/${req.params.username}/refresh`, {}));

export const leaveGroup = withUsername((req, res) => {
  console.log(`[WA-GROUPS] saída pedida de ${req.params.username} por ${req.admin?.email || 'admin'}`);
  return proxy(res, 'DELETE', `/groups/${req.params.username}`);
});

export const getAvatar = withUsername((req, res) => {
  const file = path.join(AVATARS_DIR, `${req.params.username}.jpg`);
  if (!fs.existsSync(file)) return res.status(404).send('sem foto');
  res.set('Cache-Control', 'private, max-age=60');
  return res.sendFile(file);
});
