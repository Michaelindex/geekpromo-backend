-- Migração: Adicionar campos para URLs de cupom
-- Data: 2025-01-27
-- Descrição: Adicionar campos para suporte a URLs de cupom no sistema de encurtador

ALTER TABLE product_short_urls 
ADD COLUMN redirect_url TEXT NULL,
ADD COLUMN url_type ENUM('product', 'coupon') DEFAULT 'product';
