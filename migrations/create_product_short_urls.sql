-- Migração: Sistema de Encurtador de URLs para Produtos
-- Data: 2025-09-22
-- Descrição: Criar tabela para gerenciar URLs curtas dos produtos

CREATE TABLE product_short_urls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id VARCHAR(36) NOT NULL,
  short_slug VARCHAR(50) UNIQUE NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (product_id) REFERENCES promotions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_product_custom (product_id, is_custom),
  INDEX idx_short_slug (short_slug),
  INDEX idx_product_id (product_id)
);

-- Comentários da tabela
ALTER TABLE product_short_urls COMMENT = 'Armazena URLs curtas para produtos com redirecionamento 301';

-- Comentários das colunas
ALTER TABLE product_short_urls 
  MODIFY COLUMN product_id VARCHAR(36) NOT NULL COMMENT 'ID do produto referenciado (UUID)',
  MODIFY COLUMN short_slug VARCHAR(50) UNIQUE NOT NULL COMMENT 'Slug curto único (ex: nanv5)',
  MODIFY COLUMN is_custom BOOLEAN DEFAULT FALSE COMMENT 'True se for slug personalizado',
  MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT 'True se a URL curta está ativa';
