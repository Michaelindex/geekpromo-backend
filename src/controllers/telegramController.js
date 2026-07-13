import { sendTelegramMessage } from '../config/telegram.js';

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


