import https from 'https';

/**
 * Envia uma mensagem de texto para o bot/grupo do Telegram.
 * Usa apenas variáveis de ambiente, sem expor o token em nenhuma rota pública.
 */
export async function sendTelegramMessage(text, imageUrl = null, previewOpts = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return;
  }

  // Se veio imagem, usa sendPhoto (imagem ANEXADA, sem preview de link).
  // Caption tem limite 1024 chars; nossa mensagem ~300 chars, cabe folgado.
  // Se não veio imagem, usa sendMessage:
  //   - options.linkPreview === true  → LIGA o preview de link (webView),
  //     deixando o próprio Telegram raspar a imagem da página. Usado como
  //     última tentativa (hoje só para o Mercado Livre) quando a imagem que
  //     temos seria a foto "suja" anexada pelo promoter de origem. Fixamos a
  //     URL do preview via link_preview_options.url para garantir que o cartão
  //     seja o do produto, não o do link do site no fim da mensagem.
  //   - caso contrário → preview de link desabilitado (comportamento antigo).
  const useImage = !!imageUrl;
  const method = useImage ? 'sendPhoto' : 'sendMessage';
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);

  let body;
  if (useImage) {
    body = { chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' };
  } else if (previewOpts.linkPreview) {
    const linkPreviewOptions = { is_disabled: false, prefer_large_media: true };
    if (previewOpts.previewUrl) linkPreviewOptions.url = previewOpts.previewUrl;
    body = { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: linkPreviewOptions };
  } else {
    body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
  }

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
          // Propaga o erro para o caller (publisher). O worker precisa
          // saber que o envio falhou para não marcar telegramSent=true
          // como falso positivo — e para permitir retry/reprocess.
          reject(new Error(`Telegram API ${res.statusCode}: ${String(data).slice(0, 300)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[TELEGRAM] Erro de rede ao enviar mensagem:', error);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}


