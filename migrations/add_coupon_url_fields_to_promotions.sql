-- Adicionar campos de URL de cupom à tabela promotions
ALTER TABLE promotions
ADD COLUMN has_coupon_url BOOLEAN DEFAULT FALSE,
ADD COLUMN coupon_url_slug VARCHAR(255) NULL,
ADD COLUMN coupon_url TEXT NULL;
