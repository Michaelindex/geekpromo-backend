-- ============================================================================
-- Script de Validação ANTES da Migração
-- ============================================================================
-- Execute este script para entender o impacto da migração
-- ============================================================================

-- 1. Total de registros no banco
SELECT 'TOTAL DE REGISTROS' as metrica, COUNT(*) as valor
FROM daily_visits;

-- 2. Registros afetados (0-2h UTC)
SELECT 'REGISTROS AFETADOS (0-2h UTC)' as metrica, COUNT(*) as valor
FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2;

-- 3. Registros que serão deletados (duplicatas)
SELECT 'DUPLICATAS (serão deletadas)' as metrica, COUNT(*) as valor
FROM daily_visits t1
WHERE HOUR(t1.created_at) BETWEEN 0 AND 2
  AND EXISTS (
    SELECT 1 FROM daily_visits t2
    WHERE t2.visitor_hash = t1.visitor_hash
      AND t2.visit_date = DATE_SUB(t1.visit_date, INTERVAL 1 DAY)
      AND HOUR(t2.created_at) NOT BETWEEN 0 AND 2
  );

-- 4. Registros que serão movidos
SELECT 'REGISTROS QUE SERÃO MOVIDOS' as metrica, COUNT(*) as valor
FROM daily_visits t1
WHERE HOUR(t1.created_at) BETWEEN 0 AND 2
  AND NOT EXISTS (
    SELECT 1 FROM daily_visits t2
    WHERE t2.visitor_hash = t1.visitor_hash
      AND t2.visit_date = DATE_SUB(t1.visit_date, INTERVAL 1 DAY)
      AND HOUR(t2.created_at) NOT BETWEEN 0 AND 2
  );

-- 5. Distribuição por data dos registros afetados
SELECT 
  visit_date,
  COUNT(*) as total_afetado,
  SUM(CASE WHEN HOUR(created_at) = 0 THEN 1 ELSE 0 END) as hora_0,
  SUM(CASE WHEN HOUR(created_at) = 1 THEN 1 ELSE 0 END) as hora_1,
  SUM(CASE WHEN HOUR(created_at) = 2 THEN 1 ELSE 0 END) as hora_2
FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15'
GROUP BY visit_date
ORDER BY visit_date DESC;

-- 6. Exemplo de registros que serão movidos
SELECT 
  visit_date,
  DATE_SUB(visit_date, INTERVAL 1 DAY) as nova_data,
  created_at,
  DATE_SUB(created_at, INTERVAL 3 HOUR) as horario_brasilia,
  visitor_hash
FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15'
LIMIT 10;

