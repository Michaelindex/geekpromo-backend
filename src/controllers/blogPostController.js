import BlogPost from '../models/BlogPost.js';
import BlogCategory from '../models/BlogCategory.js';

// Validação dos dados do post
const validatePostData = async (data, isUpdate = false) => {
  const errors = [];

  // Título é obrigatório
  if (!data.title || data.title.trim() === '') {
    errors.push('Título do post é obrigatório');
  } else if (data.title.length > 255) {
    errors.push('Título deve ter no máximo 255 caracteres');
  }

  // Excerpt é obrigatório
  if (!isUpdate || data.excerpt !== undefined) {
    if (!data.excerpt || data.excerpt.trim() === '') {
      errors.push('Resumo do post é obrigatório');
    } else if (data.excerpt.length > 500) {
      errors.push('Resumo deve ter no máximo 500 caracteres');
    }
  }

  // Conteúdo é obrigatório
  if (!isUpdate || data.content !== undefined) {
    if (!data.content || data.content.trim() === '') {
      errors.push('Conteúdo do post é obrigatório');
    } else if (data.content.length < 100) {
      errors.push('Conteúdo deve ter pelo menos 100 caracteres');
    }
  }

  // Author name opcional, mas limitado
  if (data.author_name && data.author_name.length > 100) {
    errors.push('Nome do autor deve ter no máximo 100 caracteres');
  }

  // URLs de imagem opcionais, mas válidas se fornecidas
  const imageFields = ['cover_image', 'og_image_url'];
  const isValidImageValue = (value) => {
    if (!value || value.trim() === '') return true;
    const v = value.trim();
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:') || v.startsWith('/')) {
      return true;
    }
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  };
  imageFields.forEach(field => {
    if (!isValidImageValue(data[field])) {
      errors.push(`URL da ${field === 'cover_image' ? 'capa' : 'imagem OG'} inválida`);
    }
  });

  // Cover image alt opcional, mas limitado
  if (data.cover_image_alt && data.cover_image_alt.length > 255) {
    errors.push('Texto alternativo da capa deve ter no máximo 255 caracteres');
  }

  // Meta fields opcionais, mas limitados
  if (data.meta_description && data.meta_description.length > 500) {
    errors.push('Meta descrição deve ter no máximo 500 caracteres');
  }
  if (data.meta_keywords && data.meta_keywords.length > 255) {
    errors.push('Meta palavras-chave devem ter no máximo 255 caracteres');
  }
  if (data.seo_title && data.seo_title.length > 255) {
    errors.push('Título SEO deve ter no máximo 255 caracteres');
  }
  if (data.seo_description && data.seo_description.length > 500) {
    errors.push('Descrição SEO deve ter no máximo 500 caracteres');
  }

  // Status deve ser válido
  if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
    errors.push('Status deve ser "draft", "published" ou "archived"');
  }

  // Published at deve ser válido se fornecido
  if (data.published_at) {
    const publishedDate = new Date(data.published_at);
    if (isNaN(publishedDate.getTime())) {
      errors.push('Data de publicação inválida');
    }
  }

  // Validar categorias se fornecidas
  if (data.category_ids) {
    if (!Array.isArray(data.category_ids)) {
      errors.push('IDs das categorias devem ser um array');
    } else if (data.category_ids.length > 5) {
      errors.push('Máximo de 5 categorias por post');
    } else {
      // Verificar se categorias existem
      for (const categoryId of data.category_ids) {
        if (typeof categoryId !== 'string' || categoryId.trim() === '') {
          errors.push('ID de categoria inválido');
          break;
        }
        
        const category = await BlogCategory.findById(categoryId);
        if (!category) {
          errors.push(`Categoria com ID ${categoryId} não encontrada`);
          break;
        }
        
        if (category.status !== 'active') {
          errors.push(`Categoria "${category.name}" está inativa`);
          break;
        }
      }
    }
  }

  return errors;
};

// Listar posts
export const listPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      category_id = '',
      author_name = '',
      date_from = '',
      date_to = '',
      sort = 'published_at',
      order = 'DESC',
      include_categories = 'false'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim(),
      status,
      category_id,
      author_name: author_name.trim(),
      date_from,
      date_to,
      sort,
      order: order.toUpperCase(),
      include_categories: include_categories === 'true'
    };

    const result = await BlogPost.findAll(options);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erro ao listar posts do blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Buscar post por ID
export const getPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { include_categories = 'false' } = req.query;
    
    const post = await BlogPost.findById(id, include_categories === 'true');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('Erro ao buscar post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Criar novo post
export const createPost = async (req, res) => {
  try {
    const postData = req.body;

    // Validar dados
    const errors = await validatePostData(postData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors
      });
    }

    // Verificar se já existe post com mesmo título
    const existingPost = await BlogPost.findBySlug(
      postData.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
    );

    if (existingPost) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um post com título similar'
      });
    }

    const post = await BlogPost.create(postData);

    res.status(201).json({
      success: true,
      message: 'Post criado com sucesso',
      data: post
    });
  } catch (error) {
    console.error('Erro ao criar post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Atualizar post
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const postData = req.body;

    // Validar dados
    const errors = await validatePostData(postData, true);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors
      });
    }

    // Verificar se post existe
    const existingPost = await BlogPost.findById(id);
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    const post = await BlogPost.update(id, postData);

    res.json({
      success: true,
      message: 'Post atualizado com sucesso',
      data: post
    });
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    
    if (error.message === 'Post não encontrado') {
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

// Excluir post
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se post existe
    const existingPost = await BlogPost.findById(id);
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    await BlogPost.delete(id);

    res.json({
      success: true,
      message: 'Post excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir post:', error);
    
    if (error.message === 'Post não encontrado') {
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

// Estatísticas dos posts
export const getPostStats = async (req, res) => {
  try {
    const stats = await BlogPost.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas dos posts:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Gerenciar categorias do post
export const getPostCategories = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se post existe
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    const categories = await BlogPost.getCategories(id);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Erro ao buscar categorias do post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

export const setPostCategories = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_ids = [] } = req.body;

    // Verificar se post existe
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    // Validar categorias
    if (!Array.isArray(category_ids)) {
      return res.status(400).json({
        success: false,
        message: 'IDs das categorias devem ser um array'
      });
    }

    if (category_ids.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Máximo de 5 categorias por post'
      });
    }

    // Verificar se categorias existem
    for (const categoryId of category_ids) {
      const category = await BlogCategory.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: `Categoria com ID ${categoryId} não encontrada`
        });
      }
    }

    const categories = await BlogPost.setCategories(id, category_ids);

    res.json({
      success: true,
      message: 'Categorias do post atualizadas com sucesso',
      data: categories
    });
  } catch (error) {
    console.error('Erro ao definir categorias do post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

export const addPostCategories = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_ids = [] } = req.body;

    // Verificar se post existe
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    // Validar categorias
    if (!Array.isArray(category_ids)) {
      return res.status(400).json({
        success: false,
        message: 'IDs das categorias devem ser um array'
      });
    }

    // Verificar se categorias existem
    for (const categoryId of category_ids) {
      const category = await BlogCategory.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: `Categoria com ID ${categoryId} não encontrada`
        });
      }
    }

    const categories = await BlogPost.addCategories(id, category_ids);

    res.json({
      success: true,
      message: 'Categorias adicionadas ao post com sucesso',
      data: categories
    });
  } catch (error) {
    console.error('Erro ao adicionar categorias ao post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

export const removePostCategory = async (req, res) => {
  try {
    const { id, categoryId } = req.params;

    // Verificar se post existe
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    // Verificar se categoria existe
    const category = await BlogCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    const categories = await BlogPost.removeCategory(id, categoryId);

    res.json({
      success: true,
      message: 'Categoria removida do post com sucesso',
      data: categories
    });
  } catch (error) {
    console.error('Erro ao remover categoria do post:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// Incrementar visualizações (para uso público futuro)
export const incrementPostViews = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se post existe e está publicado
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    if (post.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'Post não está publicado'
      });
    }

    await BlogPost.incrementViews(id);

    res.json({
      success: true,
      message: 'Visualização registrada'
    });
  } catch (error) {
    console.error('Erro ao incrementar visualizações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// API pública para listar posts publicados (para uso futuro)
export const listPublishedPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category_slug = '',
      sort = 'published_at',
      order = 'DESC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search: search.trim(),
      category_slug,
      sort,
      order: order.toUpperCase()
    };

    const result = await BlogPost.findPublished(options);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Erro ao listar posts publicados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

// API pública para buscar post por slug (para uso futuro)
export const getPublishedPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const post = await BlogPost.findBySlug(slug, true);

    if (!post || post.status !== 'published' || new Date(post.published_at) > new Date()) {
      return res.status(404).json({
        success: false,
        message: 'Post não encontrado'
      });
    }

    // Incrementar views automaticamente
    await BlogPost.incrementViews(post.id);

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('Erro ao buscar post publicado:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}; 