import express from 'express';

const router = express.Router();

// GET /api/redirect/:url - Redirecionamento intermediário para navegadores integrados
router.get('/:encodedUrl', async (req, res) => {
  try {
    const { encodedUrl } = req.params;
    
    // Decodificar URL
    const targetUrl = decodeURIComponent(encodedUrl);
    
    console.log('🔗 [REDIRECT] Redirecionando para:', targetUrl);
    
    // Verificar se é uma URL válida
    try {
      new URL(targetUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }
    
    // Para navegadores integrados, usar HTML com meta refresh e JavaScript
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecionando...</title>
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Redirecionando...</h2>
        <p>Você será redirecionado automaticamente.</p>
        <p><a href="${targetUrl}" style="color: #007bff; text-decoration: none;">Clique aqui se não for redirecionado automaticamente</a></p>
    </div>
    
    <script>
        // Múltiplas tentativas de redirecionamento
        console.log('🔗 [REDIRECT] Iniciando redirecionamento para: ${targetUrl}');
        
        // Tentativa 1: location.href imediato
        setTimeout(() => {
            console.log('🔗 [REDIRECT] Tentativa 1: location.href');
            window.location.href = '${targetUrl}';
        }, 100);
        
        // Tentativa 2: location.replace (fallback)
        setTimeout(() => {
            console.log('🔗 [REDIRECT] Tentativa 2: location.replace');
            window.location.replace('${targetUrl}');
        }, 1000);
        
        // Tentativa 3: window.open (último recurso)
        setTimeout(() => {
            console.log('🔗 [REDIRECT] Tentativa 3: window.open');
            const newWindow = window.open('${targetUrl}', '_blank');
            if (newWindow) {
                newWindow.focus();
            }
        }, 2000);
    </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ [REDIRECT] Erro no redirecionamento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
