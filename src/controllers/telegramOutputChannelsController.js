import https from 'node:https';
import TelegramOutputChannel from '../models/TelegramOutputChannel.js';
import Category from '../models/Category.js';

const GEEKAUTO_BASE_URL = process.env.GEEKAUTO_BASE_URL || 'http://127.0.0.1:3010/geekauto';
const USERNAME_RE = /^[a-zA-Z0-9_]{3,64}$/;

let botUsernameCache = null;

function extractUsername(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(@?[a-zA-Z0-9_]{3,64})\/?$/i);
  const candidate = m ? m[1] : s;
  return candidate.replace(/^@/, '');
}

function getBotUsername() {
  if (botUsernameCache) return Promise.resolve(botUsernameCache);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.reject(new Error('TELEGRAM_BOT_TOKEN não configurado'));
  return new Promise((resolve, reject) => {
    https
      .get(`https://api.telegram.org/bot${token}/getMe`, (r) => {
        let data = '';
        r.on('data', (c) => (data += c));
        r.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json?.ok && json.result?.username) {
              botUsernameCache = json.result.username;
              resolve(botUsernameCache);
            } else {
              reject(new Error('getMe falhou'));
            }
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function proxyVerify(username, botUsername) {
  const res = await fetch(`${GEEKAUTO_BASE_URL}/groups/verify-output`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: username, botUsername }),
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

export const getMeta = async (req, res) => {
  let botUsername = null;
  try {
    botUsername = await getBotUsername();
  } catch { botUsername = null; }
  return res.json({ success: true, data: { botUsername } });
};

export const listChannels = async (req, res, next) => {
  try {
    const data = await TelegramOutputChannel.findAll();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createChannel = async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const usernameRaw = req.body?.username;
    if (title.length < 2) {
      return res.status(400).json({ success: false, error: 'nome do grupo é obrigatório' });
    }
    let username = null;
    if (usernameRaw) {
      username = extractUsername(usernameRaw);
      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({ success: false, error: 'username/link inválido' });
      }
    }
    const channel = await TelegramOutputChannel.create({ title, username });
    return res.status(201).json({ success: true, data: channel });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'já existe um canal com esse username' });
    }
    next(err);
  }
};

export const updateChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await TelegramOutputChannel.findById(id);
    if (!existing) return res.status(404).json({ success: false, error: 'canal não encontrado' });

    let title;
    if (req.body?.title !== undefined) {
      title = String(req.body.title).trim();
      if (title.length < 2) return res.status(400).json({ success: false, error: 'nome inválido' });
    }
    let username;
    if (req.body?.username !== undefined) {
      username = req.body.username ? extractUsername(req.body.username) : null;
      if (username && !USERNAME_RE.test(username)) {
        return res.status(400).json({ success: false, error: 'username/link inválido' });
      }
    }
    const channel = await TelegramOutputChannel.updateBasics(id, { title, username });
    return res.json({ success: true, data: channel });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'já existe um canal com esse username' });
    }
    next(err);
  }
};

export const verifyChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const channel = await TelegramOutputChannel.findById(id);
    if (!channel) return res.status(404).json({ success: false, error: 'canal não encontrado' });
    if (!channel.username) {
      return res.status(400).json({ success: false, error: 'defina o @username do canal antes de validar' });
    }

    let botUsername;
    try {
      botUsername = await getBotUsername();
    } catch {
      return res.status(500).json({ success: false, error: 'não foi possível identificar o bot (TELEGRAM_BOT_TOKEN)' });
    }

    let result;
    try {
      result = await proxyVerify(channel.username, botUsername);
    } catch {
      return res.status(502).json({ success: false, error: 'serviço de validação (MTProto) indisponível' });
    }

    if (!result.json?.success) {
      const errMsg = result.json?.error || 'falha ao validar no Telegram';
      const updated = await TelegramOutputChannel.setVerification(id, {
        status: 'failed', chat_id: channel.chat_id, tg_title: channel.tg_title,
        member_count: channel.member_count, last_error: errMsg,
      });
      return res.status(result.status || 400).json({ success: false, error: errMsg, data: updated });
    }

    const d = result.json.data;
    if (!d.botInChannel || !d.botIsAdmin || !d.botCanPost) {
      const errMsg = !d.botInChannel
        ? `o bot @${botUsername} ainda não está no canal`
        : `o bot @${botUsername} precisa ser admin com permissão de enviar mensagens`;
      const updated = await TelegramOutputChannel.setVerification(id, {
        status: 'failed', chat_id: d.chatId, tg_title: d.title,
        member_count: d.memberCount, last_error: errMsg,
      });
      return res.status(400).json({ success: false, error: errMsg, data: updated });
    }

    const updated = await TelegramOutputChannel.setVerification(id, {
      status: 'verified', chat_id: d.chatId, tg_title: d.title,
      member_count: d.memberCount, last_error: null,
    });
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const setChannelCategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    const channel = await TelegramOutputChannel.findById(id);
    if (!channel) return res.status(404).json({ success: false, error: 'canal não encontrado' });

    const categoryIds = req.body?.category_ids;
    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ success: false, error: 'category_ids deve ser um array' });
    }
    const unique = [...new Set(categoryIds.map((c) => String(c)))];
    for (const catId of unique) {
      const cat = await Category.findById(catId);
      if (!cat) return res.status(400).json({ success: false, error: `categoria inexistente: ${catId}` });
    }
    const updated = await TelegramOutputChannel.setCategories(id, unique);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const toggleChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { active } = req.body || {};
    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active deve ser boolean' });
    }
    const channel = await TelegramOutputChannel.findById(id);
    if (!channel) return res.status(404).json({ success: false, error: 'canal não encontrado' });
    if (active && channel.status !== 'verified') {
      return res.status(400).json({ success: false, error: 'valide o canal antes de ativar' });
    }
    const updated = await TelegramOutputChannel.setActive(id, active);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ok = await TelegramOutputChannel.delete(id);
    if (!ok) return res.status(404).json({ success: false, error: 'canal não encontrado' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
