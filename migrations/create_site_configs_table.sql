-- Migration: Criar tabela site_configs
-- Data: 2025-09-29
-- Descrição: Tabela para armazenar configurações globais do site

CREATE TABLE IF NOT EXISTS site_configs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir configuração inicial do WhatsApp
INSERT INTO site_configs (config_key, config_value, description) VALUES 
('whatsapp_group_link', 'https://wa.me/5511999999999', 'Link do grupo do WhatsApp')
ON DUPLICATE KEY UPDATE 
config_value = VALUES(config_value),
description = VALUES(description),
updated_at = CURRENT_TIMESTAMP;
