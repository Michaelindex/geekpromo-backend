-- ================================================
-- MIGRAÇÃO: Adicionar índice composto para cupons
-- Data: 2025-10-04
-- Objetivo: Permitir cupons com mesmo código em lojas diferentes
-- ================================================

-- 1. Verificar se já existe índice
-- (Se existir, o MySQL retornará erro - isso é esperado)

-- 2. Adicionar índice composto para performance
CREATE INDEX IF NOT EXISTS idx_coupon_code_store ON coupons(code, store_id);

-- 3. Adicionar constraint única (código + loja)
-- NOTA: Isso pode falhar se já existirem cupons duplicados
-- Neste caso, primeiro devemos limpar os duplicados manualmente

-- Comentado por segurança - descomente após verificar dados
-- ALTER TABLE coupons 
-- ADD CONSTRAINT unique_coupon_code_per_store 
-- UNIQUE (code, store_id);

-- ================================================
-- VERIFICAÇÃO:
-- Execute esta query para verificar se há duplicados:
-- SELECT code, store_id, COUNT(*) as count 
-- FROM coupons 
-- GROUP BY code, store_id 
-- HAVING COUNT(*) > 1;
-- ================================================


