-- Migration: Criar tabela daily_visits para contador de visualizações únicas
-- Data: 2025-10-15
-- Objetivo: Armazenar visitantes únicos por dia para relatórios administrativos

CREATE TABLE IF NOT EXISTS daily_visits (
  visit_date DATE NOT NULL COMMENT 'Data da visita',
  visitor_hash CHAR(64) NOT NULL COMMENT 'Hash SHA-256 do identificador do visitante',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp de criação do registro',
  PRIMARY KEY (visit_date, visitor_hash),
  INDEX idx_visit_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro de visitantes únicos por dia para analytics';

-- Verificar criação
SELECT 'Tabela daily_visits criada com sucesso!' as status;
DESCRIBE daily_visits;