-- Migração: Adicionar sistema híbrido de ordenação para categorias
-- Data: 2025-09-30
-- Descrição: Adiciona campo use_custom_order para permitir ordenação personalizada

-- Adicionar campo use_custom_order (padrão: FALSE = ordenação por quantidade de produtos)
ALTER TABLE categories ADD COLUMN use_custom_order BOOLEAN DEFAULT FALSE AFTER sort_order;

-- Adicionar índice para performance na ordenação híbrida
CREATE INDEX idx_categories_custom_order ON categories(use_custom_order, sort_order);

-- Adicionar índice para performance na ordenação por produto count
CREATE INDEX idx_categories_product_count ON categories(status);
