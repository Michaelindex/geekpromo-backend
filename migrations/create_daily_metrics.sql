-- Criação de tabelas de métricas diárias de promoções e cupons

-- 1) Tabela de métricas diárias de promoções (visualizações por dia)
CREATE TABLE IF NOT EXISTS promotion_daily_metrics (
  promotion_id VARCHAR(36) NOT NULL,
  metric_date DATE NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (promotion_id, metric_date),
  KEY idx_promotion_daily_metrics_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Tabela de métricas diárias de cupons (cópias/cliques por dia)
CREATE TABLE IF NOT EXISTS coupon_daily_metrics (
  coupon_id VARCHAR(36) NOT NULL,
  metric_date DATE NOT NULL,
  copies INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (coupon_id, metric_date),
  KEY idx_coupon_daily_metrics_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Backfill inicial: consolidar tudo que existia até 24/11/2025
--    em uma única linha por item nessa data

-- Promoções
INSERT INTO promotion_daily_metrics (promotion_id, metric_date, views)
SELECT
  id AS promotion_id,
  DATE('2025-11-24') AS metric_date,
  COALESCE(views_count, 0) AS views
FROM promotions
ON DUPLICATE KEY UPDATE
  views = promotion_daily_metrics.views + VALUES(views);

-- Cupons
INSERT INTO coupon_daily_metrics (coupon_id, metric_date, copies)
SELECT
  id AS coupon_id,
  DATE('2025-11-24') AS metric_date,
  COALESCE(usage_count, 0) AS copies
FROM coupons
ON DUPLICATE KEY UPDATE
  copies = coupon_daily_metrics.copies + VALUES(copies);


