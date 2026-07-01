import Newsletter from '../models/Newsletter.js';

// POST /api/newsletter/subscribe - Inscrever e-mail na newsletter (público)
export const subscribe = async (req, res, next) => {
  try {
    const { email, source } = req.body;

    console.log('📧 Newsletter: Nova tentativa de inscrição:', { email, source });

    // Validações básicas
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'E-mail é obrigatório'
      });
    }

    if (!source || !source.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Source é obrigatório'
      });
    }

    // Validação formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Formato de e-mail inválido'
      });
    }

    // Obter informações da requisição
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log('📧 Newsletter: Dados da requisição:', { 
      email: email.trim(), 
      source: source.trim(), 
      ipAddress,
      userAgent: userAgent.substring(0, 100) // Truncar user agent
    });

    // Tentar inscrever
    const subscription = await Newsletter.subscribe({
      email: email.trim().toLowerCase(),
      ipAddress,
      userAgent: userAgent.substring(0, 500), // Limitar tamanho
      source: source.trim()
    });

    console.log('✅ Newsletter: Inscrição realizada com sucesso:', subscription);

    res.status(201).json({
      success: true,
      data: {
        id: subscription.id,
        email: subscription.email,
        source: subscription.source,
        subscribedAt: subscription.subscribedAt
      },
      message: 'E-mail inscrito com sucesso na newsletter!'
    });

  } catch (error) {
    console.error('❌ Erro ao processar inscrição newsletter:', error);
    
    // Retornar erro específico para o usuário
    if (error.message.includes('já está inscrito')) {
      return res.status(409).json({
        success: false,
        error: 'Este e-mail já está inscrito na nossa newsletter'
      });
    }
    
    if (error.message.includes('bloqueado') || error.message.includes('limite')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }
    
    // Erro genérico
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor. Tente novamente mais tarde.'
    });
  }
};
