-- Migration: Permitir código NULL em cupons (para link direto)
-- Data: 2024-01-XX
-- Descrição: Altera a coluna 'code' para permitir NULL, permitindo cupons sem código (link direto)

-- IMPORTANTE: Execute esta migration no banco de dados antes de usar a funcionalidade de link direto

-- 1. Remover índice único que inclui code (já que NULL pode aparecer múltiplas vezes)
-- MySQL não suporta índices parciais, então removemos o índice único
-- A validação de unicidade será feita no código da aplicação
ALTER TABLE coupons DROP INDEX unique_store_code;

-- 2. Remover constraint NOT NULL da coluna code
ALTER TABLE coupons MODIFY COLUMN code VARCHAR(50) NULL;

-- 3. Criar índice não-único para melhor performance em consultas
CREATE INDEX idx_coupons_code ON coupons(code);

-- Nota: A validação de unicidade de código por loja agora é feita no código da aplicação
-- (método findByCodeAndStore no modelo Coupon.js)

