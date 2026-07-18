// Controller dos grupos monitorados pelo geekpromo-auto (listener MTProto).
//
// Fonte da verdade em disco:
//   /root/Geekloko/geekpromo-auto/data/groups.json     ← lista + estado ativo/inativo
//   /root/Geekloko/geekpromo-auto/data/groups.refresh  ← pedido de refresh de metadata (o server.js consome e apaga)
//   /root/Geekloko/geekpromo-auto/data/avatars/*.jpg   ← fotos dos grupos (baixadas via MTProto)
//
// Este controller NÃO abre porta nova nem faz chamada de rede: mesmo padrão do pipelineController,
// tudo é I/O em arquivos no mesmo host. Toggle/list roda em ms; refresh é assíncrono (server.js
// vê o pedido no próximo tick, chama o Telegram e regrava groups.json).
//
// Ativar/desativar um grupo aqui NÃO toca em pipeline.lock, mode, nem no ctl.sh — só muda
// quais grupos o listener escuta.

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.GEEKAUTO_DATA_DIR || '/root/Geekloko/geekpromo-auto/data';
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const REFRESH_FILE = path.join(DATA_DIR, 'groups.refresh');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,64}$/;

function readGroups() {
  try {
    const raw = fs.readFileSync(GROUPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.groups)) return { updated_at: null, groups: [] };
    return parsed;
  } catch {
    return { updated_at: null, groups: [] };
  }
}

function writeGroups(groups) {
  const out = { updated_at: new Date().toISOString(), groups };
  const tmp = GROUPS_FILE + '.tmp';
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, GROUPS_FILE);
  return out;
}

function requestRefresh(usernames) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    REFRESH_FILE,
    JSON.stringify({ usernames, requested_at: new Date().toISOString() }, null, 2)
  );
}

// GET /api/admin/telegram-groups
export const listGroups = (req, res) => {
  const data = readGroups();
  return res.json({ success: true, data });
};

// POST /api/admin/telegram-groups/:username/toggle  { active: bool }
export const toggleGroup = (req, res) => {
  const { username } = req.params;
  const { active } = req.body || {};
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, error: 'username inválido' });
  }
  if (typeof active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'active deve ser boolean' });
  }
  const data = readGroups();
  const entry = data.groups.find((g) => g.username === username);
  if (!entry) {
    return res.status(404).json({ success: false, error: 'grupo não encontrado' });
  }
  entry.active = active;
  const saved = writeGroups(data.groups);
  console.log(`[TG-GROUPS] ${username} → ${active ? 'ATIVO' : 'INATIVO'} por ${req.admin?.email || 'admin'}`);
  return res.json({ success: true, data: saved });
};

// POST /api/admin/telegram-groups/refresh  { usernames?: string[] }
// Sem body → refresh de todos os grupos conhecidos.
export const refreshGroups = (req, res) => {
  const data = readGroups();
  let usernames = req.body?.usernames;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    usernames = data.groups.map((g) => g.username);
  }
  const invalid = usernames.filter((u) => !USERNAME_RE.test(u));
  if (invalid.length) {
    return res.status(400).json({ success: false, error: `username(s) inválido(s): ${invalid.join(', ')}` });
  }
  const known = new Set(data.groups.map((g) => g.username));
  const unknown = usernames.filter((u) => !known.has(u));
  if (unknown.length) {
    return res.status(404).json({ success: false, error: `desconhecido(s): ${unknown.join(', ')}` });
  }
  requestRefresh(usernames);
  return res.json({ success: true, data: { queued: usernames } });
};

// GET /api/admin/telegram-groups/:username/avatar
// Serve a foto do grupo do cache local. 404 se não houver.
export const getAvatar = (req, res) => {
  const { username } = req.params;
  if (!USERNAME_RE.test(username)) return res.status(400).send('username inválido');
  const p = path.join(AVATARS_DIR, `${username}.jpg`);
  if (!fs.existsSync(p)) return res.status(404).send('sem foto');
  res.set('Cache-Control', 'private, max-age=60');
  return res.sendFile(p);
};
