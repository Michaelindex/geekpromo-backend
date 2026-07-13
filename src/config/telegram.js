import https from 'https';

/**
 * Envia uma mensagem de texto para o bot/grupo do Telegram.
 * Usa apenas variáveis de ambiente, sem expor o token em nenhuma rota pública.
 */
export async function sendTelegramMessage(text, imageUrl = null) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return;
    }

    // Se veio imagem, usa sendPhoto (imagem ANEXADA, sem preview de link).
    // Caption tem limite 1024 chars; nossa mensagem ~300 chars, cabe folgado.
    // Se não veio imagem, usa sendMessage com preview de link desabilitado.
    const useImage = !!imageUrl;
    const method = useImage ? 'sendPhoto' : 'sendMessage';
    const url = new URL(`https://api.telegram.org/bot${token}/${method}`);

    const body = useImage
      ? { chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'Markdown' }
      : { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true };

    const payload = JSON.stringify(body);

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


