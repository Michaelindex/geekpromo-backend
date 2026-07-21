import crypto from 'node:crypto';
import { sendTelegramMessage } from '../config/telegram.js';

// Dedup em memória: previne double-post no canal quando o publisher retenta
// após timeout de rede (mas o 1º envio já foi entregue). Chave = sha1(text|image_url).
// TTL = 120s cobre com folga o timeout+backoff do publisher (25s + retries).
const IDEMPOTENCY_TTL_MS = 120_000;
const recentSends = new Map(); // key -> timestamp
function pruneRecent(now) {
  for (const [k, ts] of recentSends) {
    if (now - ts > IDEMPOTENCY_TTL_MS) recentSends.delete(k);
  }
}
function idempotencyKey(text, imageUrl) {
  return crypto.createHash('sha1').update(`${text}|${imageUrl || ''}`).digest('hex');
}

/**
 * Controller para enviar mensagens de promoção ao Telegram.
 * Endpoint: POST /api/integrations/telegram/send-promotion
 *
 * Espera no body:
 * {
 *   "text": "mensagem já formatada (mesmo conteúdo do modal/share)"
 * }
 */
export const sendPromotionMessage = async (req, res, next) => {
  try {
    const { text, image_url } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo "text" é obrigatório e deve ser uma string não vazia',
      });
    }

    const now = Date.now();
    pruneRecent(now);
    const key = idempotencyKey(text, image_url);
    const seenAt = recentSends.get(key);
    if (seenAt) {
      const ageMs = now - seenAt;
      console.log(`[TELEGRAM] envio duplicado ignorado (idempotency hit, ageMs=${ageMs})`);
      return res.json({
        success: true,
        message: 'Mensagem já enviada recentemente (idempotency)',
        deduped: true,
      });
    }
    recentSends.set(key, now);

    // Enviar mensagem para o Telegram de forma assíncrona.
    // Se image_url vier, anexa como foto (sendPhoto); senão manda texto sem preview.
    await sendTelegramMessage(text, image_url || null);

    return res.json({
      success: true,
      message: 'Mensagem enviada para o Telegram (ou agendada para envio)',
    });
  } catch (error) {
    console.error('[TELEGRAM] Erro no controller sendPromotionMessage:', error);
    // Não expor detalhes internos ao cliente
    return res.status(500).json({
      success: false,
      error: 'Erro ao enviar mensagem para o Telegram',
    });
  }
};


