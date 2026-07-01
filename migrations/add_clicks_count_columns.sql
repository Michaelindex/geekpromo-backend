-- Migration: Adicionar colunas clicks_count para tracking
-- Data: 2024-01-22

-- Adicionar coluna clicks_count na tabela stores
ALTER TABLE stores 
ADD COLUMN clicks_count INT DEFAULT 0 NOT NULL 
AFTER status;

-- Adicionar coluna clicks_count na tabela categories  
ALTER TABLE categories 
ADD COLUMN clicks_count INT DEFAULT 0 NOT NULL 
AFTER status;

-- Comentários das colunas
ALTER TABLE stores 
MODIFY COLUMN clicks_count INT DEFAULT 0 NOT NULL COMMENT 'Contador de cliques na loja';

ALTER TABLE categories 
MODIFY COLUMN clicks_count INT DEFAULT 0 NOT NULL COMMENT 'Contador de cliques na categoria';
