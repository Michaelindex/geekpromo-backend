-- Migration: Adicionar campos para parcelamento no cartão de crédito
-- Data: 2024-01-XX
-- Descrição: Adiciona campos para controlar pagamento no cartão de crédito

-- Adicionar campos para cartão de crédito na tabela promotions
ALTER TABLE promotions 
ADD COLUMN has_credit_card BOOLEAN DEFAULT FALSE COMMENT 'Indica se o produto aceita pagamento no cartão de crédito',
ADD COLUMN credit_card_price DECIMAL(10,2) NULL COMMENT 'Preço do produto no cartão de crédito',
ADD COLUMN max_installments INT UNSIGNED NULL COMMENT 'Quantidade máxima de parcelas sem juros';

-- Adicionar índices para melhor performance
CREATE INDEX idx_promotions_has_credit_card ON promotions(has_credit_card);
CREATE INDEX idx_promotions_credit_card_price ON promotions(credit_card_price);

-- Comentários para documentação
ALTER TABLE promotions 
MODIFY COLUMN has_credit_card BOOLEAN DEFAULT FALSE COMMENT 'Indica se o produto aceita pagamento no cartão de crédito',
MODIFY COLUMN credit_card_price DECIMAL(10,2) NULL COMMENT 'Preço do produto no cartão de crédito (obrigatório se has_credit_card = true)',
MODIFY COLUMN max_installments INT UNSIGNED NULL COMMENT 'Quantidade máxima de parcelas sem juros (obrigatório se has_credit_card = true)';
