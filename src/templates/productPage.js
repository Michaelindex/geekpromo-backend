const productPageTemplate = (product) => {
  // 🔧 CORRIGIR URL DA IMAGEM: remover :3001 e garantir que seja https://geekpromo.com.br/uploads/...
  const fixImageUrl = (url) => {
    if (!url) return '';
    // Se já tem o domínio com porta, remover a porta
    url = url.replace('https://geekpromo.com.br:3001', 'https://geekpromo.com.br');
    url = url.replace('http://geekpromo.com.br:3001', 'https://geekpromo.com.br');
    // Se for path relativo, adicionar domínio
    if (url.startsWith('/')) {
      return `https://geekpromo.com.br${url}`;
    }
    return url;
  };
  
  const productImageUrl = fixImageUrl(product.image_url);
  
  return `
<!DOCTYPE html>
<html lang="pt-BR" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${product.title} - GEEK PROMO</title>
    
    <!-- Open Graph / Facebook / WhatsApp / Telegram -->
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="GEEK PROMO">
    <meta property="og:title" content="${product.title}">
    <meta property="og:image" content="${productImageUrl}">
    <meta property="og:image:secure_url" content="${productImageUrl}">
    <meta property="og:image:alt" content="${product.title}">
    <meta property="og:url" content="https://geekpromo.com.br/p/${product.slug}">
    
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@geekpromo">
    <meta name="twitter:title" content="${product.title}">
    <meta name="twitter:image" content="${productImageUrl}">
    
    <!-- Redirect para SPA -->
    <script>
        // Redirecionar usuários normais para SPA
        if (!navigator.userAgent.match(/(facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Telegram|Slackbot|SkypeUriPreview|Discordbot|Googlebot|Bingbot)/i)) {
            window.location.href = '/p/${product.slug}';
        }
    </script>
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
        }
        .product-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .product-title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
        }
        .product-description {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .price {
            font-size: 28px;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 20px;
        }
        .cta-button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
        }
        .cta-button:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${productImageUrl}" alt="${product.title}" class="product-image" onerror="this.style.display='none'">
        <h1 class="product-title">${product.title}</h1>
        ${product.description ? `<p class="product-description">${product.description}</p>` : ''}
        ${product.price_now ? `<div class="price">R$ ${parseFloat(product.price_now).toFixed(2).replace('.', ',')}</div>` : ''}
        <a href="https://geekpromo.com.br/p/${product.slug}" class="cta-button">Ver Produto Completo</a>
    </div>
</body>
</html>`;
};

export default productPageTemplate;
