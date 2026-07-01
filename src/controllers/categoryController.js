import Category from '../models/Category.js';
import { query } from '../config/database.js';

// Validar URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Sanitizar URL (adicionar https:// se necessário)
function sanitizeUrl(url) {
  if (!url) return null;
  
  url = url.trim();
  if (!url) return null;
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  
  return url;
}

// Validar dados da categoria
function validateCategoryData(data, isUpdate = false) {
  const errors = [];
  
  // Nome (obrigatório na criação)
  if (!isUpdate && (!data.name || !data.name.trim())) {
    errors.push('Nome da categoria é obrigatório');
  } else if (data.name && data.name.trim().length < 3) {
    errors.push('Nome da categoria deve ter pelo menos 3 caracteres');
  } else if (data.name && data.name.trim().length > 100) {
    errors.push('Nome da categoria não pode ter mais de 100 caracteres');
  }

  // Descrição (opcional)
  if (data.description && data.description.length > 1000) {
    errors.push('Descrição não pode ter mais de 1000 caracteres');
  }

  // URL da imagem (opcional)
  if (data.image_url && data.image_url.trim()) {
    const sanitizedUrl = sanitizeUrl(data.image_url);
    if (!isValidUrl(sanitizedUrl)) {
      errors.push('URL da imagem é inválida');
    }
  }

  // Ícone (opcional)
  if (data.icon && data.icon.length > 50) {
    errors.push('Ícone não pode ter mais de 50 caracteres');
  }

  // Ordem de exibição (opcional)
  if (data.sort_order !== undefined && data.sort_order !== null) {
    const sortOrder = parseInt(data.sort_order);
    if (isNaN(sortOrder) || sortOrder < 0) {
      errors.push('Ordem de exibição deve ser um número inteiro positivo');
    }
  }

  // Validação do sistema híbrido de ordenação
  if (data.use_custom_order !== undefined && data.use_custom_order !== null) {
    // Se use_custom_order for true, sort_order deve ser válido
    if (data.use_custom_order && (!data.sort_order || data.sort_order < 1)) {
      errors.push('Quando usar ordem personalizada, a posição deve ser um número maior que 0');
    }
  }

  // Status (opcional)
  if (data.status && !['active', 'inactive'].includes(data.status)) {
    errors.push('Status deve ser "active" ou "inactive"');
  }

  return errors;
}

// Função para reordenar categorias automaticamente
async function reorderCategories(newCategoryId, targetPosition) {
  console.log('🔄 [DEBUG] Reordenando categorias - ID:', newCategoryId, 'Posição:', targetPosition);
  
  try {
    // Incrementar todas as categorias com sort_order >= targetPosition
    const updateSql = `
      UPDATE categories 
      SET sort_order = sort_order + 1 
      WHERE use_custom_order = 1 
        AND sort_order >= ? 
        AND id != ?
    `;
    
    await query(updateSql, [targetPosition, newCategoryId]);
    
    console.log('✅ [DEBUG] Categorias reordenadas com sucesso');
    
    // Log das categorias após reordenação
    const categoriesAfter = await query(`
      SELECT id, name, sort_order, use_custom_order 
      FROM categories 
      WHERE use_custom_order = 1 
      ORDER BY sort_order ASC
    `);
    
    console.log('📊 [DEBUG] Categorias após reordenação:', categoriesAfter);
    
  } catch (error) {
    console.error('❌ [DEBUG] Erro ao reordenar categorias:', error);
    throw error;
  }
}

// Listar categorias com paginação e filtros
export const listCategories = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort_by = 'sort_order',
      sort_order = 'ASC'
    } = req.query;

    // Validar parâmetros
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Página deve ser um número maior que 0'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limite deve ser um número entre 1 e 100'
      });
    }

    const options = {
      page: pageNum,
      limit: limitNum,
      search: search.toString(),
      status: status.toString(),
      sort_by: sort_by.toString(),
      sort_order: sort_order.toString()
    };

    const result = await Category.findAll(options);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: `${result.data.length} categoria(s) encontrada(s)`
    });

  } catch (error) {
    next(error);
  }
};

// Buscar categoria por ID
export const getCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da categoria é obrigatório'
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: category,
      message: 'Categoria encontrada com sucesso'
    });

  } catch (error) {
    next(error);
  }
};

// Criar nova categoria
export const createCategory = async (req, res, next) => {
  try {
    const categoryData = req.body;

    // Validar dados
    const errors = validateCategoryData(categoryData, false);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    // Sanitizar URL da imagem
    if (categoryData.image_url) {
      categoryData.image_url = sanitizeUrl(categoryData.image_url);
    }

    console.log('🔍 [DEBUG] Criando categoria com dados:', categoryData);

    // Se usar ordem personalizada, reordenar outras categorias
    if (categoryData.use_custom_order && categoryData.sort_order) {
      console.log('🔄 [DEBUG] Categoria usa ordem personalizada, reordenando...');
      // Primeiro criar a categoria
      const newCategory = await Category.create(categoryData);
      
      // Depois reordenar
      await reorderCategories(newCategory.id, parseInt(categoryData.sort_order));
      
      console.log('✅ [DEBUG] Categoria criada e reordenada:', newCategory.id);
      
      res.status(201).json({
        success: true,
        data: newCategory,
        message: 'Categoria criada com sucesso'
      });
      return;
    }

    // Criar categoria normalmente (sem ordem personalizada)
    const newCategory = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      data: newCategory,
      message: 'Categoria criada com sucesso'
    });

  } catch (error) {
    // Erro de slug duplicado
    if (error.message.includes('Duplicate entry') && error.message.includes('slug')) {
      return res.status(409).json({
        success: false,
        error: 'Já existe uma categoria com este nome/slug'
      });
    }

    next(error);
  }
};

// Atualizar categoria
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const categoryData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da categoria é obrigatório'
      });
    }

    // Validar dados
    const errors = validateCategoryData(categoryData, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors
      });
    }

    // Sanitizar URL da imagem
    if (categoryData.image_url) {
      categoryData.image_url = sanitizeUrl(categoryData.image_url);
    }

    console.log('🔍 [DEBUG] Atualizando categoria ID:', id, 'com dados:', categoryData);

    // Se usar ordem personalizada, reordenar outras categorias
    if (categoryData.use_custom_order && categoryData.sort_order) {
      console.log('🔄 [DEBUG] Categoria usa ordem personalizada, reordenando...');
      
      // Primeiro atualizar a categoria
      const updatedCategory = await Category.update(id, categoryData);
      
      if (!updatedCategory) {
        return res.status(404).json({
          success: false,
          error: 'Categoria não encontrada'
        });
      }
      
      // Depois reordenar
      await reorderCategories(id, parseInt(categoryData.sort_order));
      
      console.log('✅ [DEBUG] Categoria atualizada e reordenada:', id);
      
      res.status(200).json({
        success: true,
        data: updatedCategory,
        message: 'Categoria atualizada com sucesso'
      });
      return;
    }

    // Atualizar categoria normalmente (sem ordem personalizada)
    const updatedCategory = await Category.update(id, categoryData);

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedCategory,
      message: 'Categoria atualizada com sucesso'
    });

  } catch (error) {
    // Erro de slug duplicado
    if (error.message.includes('Duplicate entry') && error.message.includes('slug')) {
      return res.status(409).json({
        success: false,
        error: 'Já existe uma categoria com este nome/slug'
      });
    }

    next(error);
  }
};

// Deletar categoria
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da categoria é obrigatório'
      });
    }

    const deleted = await Category.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Categoria deletada com sucesso'
    });

  } catch (error) {
    // Erros específicos do modelo
    if (error.message.includes('subcategorias') || error.message.includes('produtos vinculados')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    next(error);
  }
};

// Listar categorias para select (ativas)
export const getCategoriesForSelect = async (req, res, next) => {
  try {
    const categories = await Category.findForSelect();

    res.status(200).json({
      success: true,
      data: categories,
      message: `${categories.length} categoria(s) ativa(s) encontrada(s)`
    });

  } catch (error) {
    next(error);
  }
};

// Estatísticas das categorias
export const getCategoryStats = async (req, res, next) => {
  try {
    const stats = await Category.getStats();

    res.status(200).json({
      success: true,
      data: stats,
      message: 'Estatísticas das categorias obtidas com sucesso'
    });

  } catch (error) {
    next(error);
  }
};

// Buscar top categorias ordenadas por número de produtos
export const getTopCategories = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    // Validar limite
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        error: 'Limite deve ser um número entre 1 e 50'
      });
    }

    const result = await Category.findTopCategoriesWithProductCount(limitNum);

    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      message: `${result.data.length} categoria(s) encontrada(s)`
    });

  } catch (error) {
    next(error);
  }
};

// Cache em memória para rate limiting de categorias (2 minutos)
const categoryClickCache = new Map();

// Limpar cache antigo a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of categoryClickCache.entries()) {
    if (now - timestamp > 5 * 60 * 1000) { // 5 minutos
      categoryClickCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// POST /api/categories/:id/track-click - Tracking de clique em categoria
export const trackCategoryClick = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    console.log(`📊 [CATEGORY TRACKING] Click na categoria ${id} do IP ${clientIP}`);

    // Verificar se categoria existe
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Categoria não encontrada'
      });
    }

    // Verificar se categoria está ativa
    if (category.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Categoria não está ativa'
      });
    }

    // RATE LIMITING: Verificar se IP já clicou nesta categoria nos últimos 2 minutos
    const cacheKey = `${clientIP}_category_${id}`;
    const lastClick = categoryClickCache.get(cacheKey);
    const now = Date.now();
    
    if (lastClick && (now - lastClick) < 120000) { // 2 minutos = 120 segundos
      const remainingTime = Math.ceil((120000 - (now - lastClick)) / 1000);
      console.log(`🚫 [CATEGORY RATE LIMIT] IP ${clientIP} tentou spam na categoria ${id}. Aguarde ${remainingTime}s`);
      
      return res.status(429).json({
        success: false,
        error: `Aguarde ${remainingTime} segundos antes de clicar novamente nesta categoria`,
        retry_after: remainingTime
      });
    }

    // Registrar click no cache
    categoryClickCache.set(cacheKey, now);

    // Incrementar contador de cliques
    await Category.incrementClicks(id);

    console.log(`✅ [CATEGORY TRACKING] Click registrado para categoria ${id} do IP ${clientIP}`);

    res.json({
      success: true,
      message: 'Click na categoria registrado com sucesso',
      data: {
        category_id: id,
        category_name: category.name,
        clicks_count: category.clicks_count + 1
      }
    });

  } catch (error) {
    console.error('❌ [CATEGORY TRACKING] Erro ao registrar click na categoria:', error);
    next(error);
  }
};

// POST /api/categories/:id/force-delete - Forçar deleção de categoria
export const forceDeleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID da categoria é obrigatório'
      });
    }

    console.log(`🗑️ [FORCE DELETE] Iniciando deleção forçada da categoria ${id}`);

    const result = await Category.forceDelete(id);

    console.log(`✅ [FORCE DELETE] Categoria ${id} deletada com sucesso`);

    res.status(200).json({
      success: true,
      message: `Categoria "${result.category_name}" removida e desvinculada de ${result.removed_links} produto(s)`,
      data: {
        removed_links: result.removed_links,
        category_name: result.category_name
      }
    });

  } catch (error) {
    console.error('❌ [FORCE DELETE] Erro ao forçar deleção:', error);
    
    // Erros específicos do modelo
    if (error.message === 'Categoria não encontrada') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('subcategorias')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    next(error);
  }
}; 