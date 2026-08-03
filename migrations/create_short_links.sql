-- Migração: Encurtador próprio na raiz do domínio (geekpromo.com.br/XXXX)
-- Data: 2026-08-03
-- Descrição: Tabela do encurtador que atende códigos de 4 caracteres logo
--            após a barra. NÃO tem relação com `product_short_urls` (aquela
--            serve /p/ e /go/ e continua intocada) — namespace diferente,
--            tabela separada de propósito para não haver risco de mexer nos
--            ~40 mil registros que já funcionam.
--
-- Sem FOREIGN KEY: o destino é uma URL externa (link de afiliado), não um
-- produto do banco. Zero acoplamento.

CREATE TABLE IF NOT EXISTS short_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  source VARCHAR(32) DEFAULT NULL,
  brand VARCHAR(32) DEFAULT NULL,
  ref VARCHAR(64) DEFAULT NULL,
  clicks INT NOT NULL DEFAULT 0,
  last_click_at TIMESTAMP NULL DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_code (code),
  INDEX idx_source (source),
  INDEX idx_ref (ref)
);

ALTER TABLE short_links COMMENT = 'Encurtador na raiz do dominio: geekpromo.com.br/{code} -> target_url (302)';

ALTER TABLE short_links
  MODIFY COLUMN code VARCHAR(16) NOT NULL COMMENT 'Codigo curto unico, hoje 4 chars [a-z0-9] (ex: ab12)',
  MODIFY COLUMN target_url TEXT NOT NULL COMMENT 'URL de destino do redirect (link de afiliado)',
  MODIFY COLUMN source VARCHAR(32) DEFAULT NULL COMMENT 'Origem do link (ex: awin)',
  MODIFY COLUMN brand VARCHAR(32) DEFAULT NULL COMMENT 'Marca quando aplicavel (nike, asics, centauro, samsung, kabum)',
  MODIFY COLUMN ref VARCHAR(64) DEFAULT NULL COMMENT 'Referencia de origem para rastreio (ex: messageId do Telegram)',
  MODIFY COLUMN clicks INT NOT NULL DEFAULT 0 COMMENT 'Total de cliques no link curto',
  MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT 'False desativa o redirect sem apagar o registro';
