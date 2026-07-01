import BlogCategory from '../models/BlogCategory.js';

// Validação dos dados da categoria
const validateCategoryData = (data) => {
  const errors = [];

  // Nome é obrigatório
  if (!data.name || data.name.trim() === '') {
    errors.push('Nome da categoria é obrigatório');
  } else if (data.name.length > 100) {
    errors.push('Nome da categoria deve ter no máximo 100 caracteres');
  }

  // Descrição opcional, mas limitada
  if (data.description && data.description.length > 1000) {
    errors.push('Descrição deve ter no máximo 1000 caracteres');
  }

  // Image URL opcional, mas válida se fornecida
  if (data.image_url && data.image_url.trim() !== '') {
    try {
      new URL(data.image_url);
    } catch {
      errors.push('URL da imagem inválida');
    }
  }

  // Sort order deve ser número se fornecido
  if (data.sort_order !== undefined && data.sort_order !== null) {
    const sortOrder = parseInt(data.sort_order);
    if (isNaN(sortOrder) || sortOrder < 0) {
      errors.push('Ordem de exibição deve ser um número positivo');
    }
  }

  // Status deve ser válido se fornecido
  if (data.status && !['active', 'inactive'].includes(data.status)) {
    errors.push('Status deve ser "active" ou "inactive"');
  }

  return errors;
};

// Listar categorias
export const listCategories = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'sort_order',
      order = 'ASC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim(),
      status,
      sort,
      order: order.toUpperCase()
    };

    const result = await BlogCategory.findAll(options);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erro ao listar categorias do blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Buscar categoria por ID
export const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await BlogCategory.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Erro ao buscar categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Criar nova categoria
export const createCategory = async (req, res) => {
  try {
    const categoryData = req.body;

    // Validar dados
    const errors = validateCategoryData(categoryData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors
      });
    }

    // Verificar se já existe categoria com mesmo nome
    const existingCategory = await BlogCategory.findBySlug(
      categoryData.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
    );

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Já existe uma categoria com nome similar'
      });
    }

    const category = await BlogCategory.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso',
      data: category
    });
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Atualizar categoria
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryData = req.body;

    // Validar dados
    const errors = validateCategoryData(categoryData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors
      });
    }

    // Verificar se categoria existe
    const existingCategory = await BlogCategory.findById(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    const category = await BlogCategory.update(id, categoryData);

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      data: category
    });
  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    
    if (error.message === 'Categoria não encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Excluir categoria
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se categoria existe
    const existingCategory = await BlogCategory.findById(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    await BlogCategory.delete(id);

    res.json({
      success: true,
      message: 'Categoria excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    
    if (error.message === 'Categoria não encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Não é possível excluir categoria com posts vinculados') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Buscar categorias para select
export const getCategoriesForSelect = async (req, res) => {
  try {
    const categories = await BlogCategory.findForSelect();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Erro ao buscar categorias para select:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Estatísticas das categorias
export const getCategoryStats = async (req, res) => {
  try {
    const stats = await BlogCategory.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas das categorias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}; 