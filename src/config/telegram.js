import https from 'https';

/**
 * Envia uma mensagem de texto para o bot/grupo do Telegram.
 * Usa apenas variáveis de ambiente, sem expor o token em nenhuma rota pública.
 */
export async function sendTelegramMessage(text) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return;
    }

    const url = new URL(`https://api.telegram.org/bot${token}/sendMessage`);

    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    });

    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            console.error('[TELEGRAM] Erro na resposta da API:', res.statusCode, data);
            // Não rejeitar para não quebrar fluxo de negócio principal
            resolve();
          }
        });
      });

      req.on('error', (error) => {
        console.error('[TELEGRAM] Erro de rede ao enviar mensagem:', error);
        // Não rejeitar para não quebrar fluxo de negócio principal
        resolve();
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    console.error('[TELEGRAM] Erro inesperado ao enviar mensagem:', error);
    // Não propagar o erro para não impactar criação/edição do produto
  }
}


