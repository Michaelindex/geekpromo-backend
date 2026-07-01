-- Adicionar coluna redirect_url na tabela coupons
-- Esta coluna armazenará o link para onde o usuário será redirecionado após copiar o cupom

ALTER TABLE coupons 
ADD COLUMN redirect_url VARCHAR(500) NULL 
COMMENT 'URL para redirecionamento após copiar o cupom';

-- Adicionar índice para melhor performance em consultas
CREATE INDEX idx_coupons_redirect_url ON coupons(redirect_url);
