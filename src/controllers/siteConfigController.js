import SiteConfig from '../models/SiteConfig.js';

// GET /api/site-config/public/:key - Buscar configuração pública por chave
export const getPublicConfig = async (req, res, next) => {
  try {
    const { key } = req.params;

    console.log('🔍 Buscando configuração pública:', key);

    if (!key || key.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Chave da configuração é obrigatória'
      });
    }

    const config = await SiteConfig.getByKey(key);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    console.log('📊 Configuração encontrada:', config.config_key);

    res.json({
      success: true,
      data: {
        key: config.config_key,
        value: config.config_value,
        description: config.description
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configuração pública:', error);
    next(error);
  }
};

// GET /api/site-config - Listar todas as configurações (admin)
export const getAllConfigs = async (req, res, next) => {
  try {
    console.log('🔍 Buscando todas as configurações (admin)');

    const configs = await SiteConfig.getAll();

    console.log(`📊 Encontradas ${configs.length} configurações`);

    res.json({
      success: true,
      data: configs,
      total: configs.length
    });

  } catch (error) {
    console.error('❌ Erro ao buscar todas as configurações:', error);
    next(error);
  }
};

// GET /api/site-config/:key - Buscar configuração por chave (admin)
export const getConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;

    console.log('🔍 [BACKEND ADMIN] Buscando configuração por chave (admin):', key);
    console.log('🔍 [BACKEND ADMIN] URL completa:', req.originalUrl);
    console.log('🔍 [BACKEND ADMIN] Method:', req.method);

    if (!key || key.trim() === '') {
      console.log('❌ [BACKEND ADMIN] Chave vazia ou inválida');
      return res.status(400).json({
        success: false,
        error: 'Chave da configuração é obrigatória'
      });
    }

    console.log('🔍 [BACKEND ADMIN] Chamando SiteConfig.getByKey...');
    const config = await SiteConfig.getByKey(key);
    console.log('🔍 [BACKEND ADMIN] Resultado do banco:', config);

    if (!config) {
      console.log('❌ [BACKEND ADMIN] Configuração não encontrada no banco');
      return res.status(404).json({
        success: false,
        error: 'Configuração não encontrada'
      });
    }

    console.log('✅ [BACKEND ADMIN] Configuração encontrada (admin):', config.config_key);

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('❌ [BACKEND ADMIN] Erro ao buscar configuração (admin):', error);
    next(error);
  }
};

// POST /api/site-config - Criar nova configuração (admin)
export const createConfig = async (req, res, next) => {
  try {
    const { config_key, config_value, description } = req.body;

    console.log('📝 Criando nova configuração:', config_key);

    // Validações
    if (!config_key || config_key.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Chave da configuração é obrigatória'
      });
    }

    // Valor pode ser vazio em algumas configs (ex: links opcionais de banners)
    // Aqui garantimos apenas que o campo exista, deixando validações mais
    // específicas para cada caso de uso no frontend.
    if (config_value === undefined || config_value === null) {
      return res.status(400).json({
        success: false,
        error: 'Valor da configuração é obrigatório'
      });
    }

    // Verificar se a chave já existe
    const existingConfig = await SiteConfig.getByKey(config_key);
    if (existingConfig) {
      return res.status(400).json({
        success: false,
        error: 'Já existe uma configuração com esta chave'
      });
    }

    const config = await SiteConfig.create({
      config_key: config_key.trim(),
      config_value: config_value.trim(),
      description: description?.trim() || null
    });

    console.log('✅ Configuração criada:', config.config_key);

    res.status(201).json({
      success: true,
      data: config,
      message: 'Configuração criada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar configuração:', error);
    next(error);
  }
};

// PUT /api/site-config/:key - Atualizar configuração (admin)
export const updateConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { config_value, description } = req.body;

    console.log('📝 Atualizando configuração:', key);

    if (!key || key.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Chave da configuração é obrigatória'
      });
    }

    if (!config_value || config_value.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Valor da configuração é obrigatório'
      });
    }

    const config = await SiteConfig.updateByKey(key, {
      config_value: config_value.trim(),
      description: description?.trim() || null
    });

    console.log('✅ Configuração atualizada:', config.config_key);

    res.json({
      success: true,
      data: config,
      message: 'Configuração atualizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configuração:', error);
    if (error.message === 'Configuração não encontrada') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};

// DELETE /api/site-config/:key - Deletar configuração (admin)
export const deleteConfig = async (req, res, next) => {
  try {
    const { key } = req.params;

    console.log('🗑️ Deletando configuração:', key);

    if (!key || key.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Chave da configuração é obrigatória'
      });
    }

    await SiteConfig.deleteByKey(key);

    console.log('✅ Configuração deletada:', key);

    res.json({
      success: true,
      message: 'Configuração deletada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar configuração:', error);
    if (error.message === 'Configuração não encontrada') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};
