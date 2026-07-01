-- ============================================================================
-- Script de Migração: Correção de Timezone para GMT-3 (Brasília)
-- ============================================================================
-- 
-- OBJETIVO:
-- Corrigir registros de visitas que foram salvos com timezone UTC quando
-- deveriam estar em GMT-3. Visitas entre 00h-02h59 UTC são, na verdade,
-- visitas de 21h-23h59 GMT-3 do dia anterior.
--
-- ANÁLISE PRÉVIA:
-- - Total de registros afetados: 3.346
-- - Registros duplicados (já existem no dia anterior): 1.108
-- - Registros que serão movidos: 2.238
--
-- ESTRATÉGIA:
-- 1. Criar backup em tabela temporária
-- 2. Deletar registros duplicados (que já têm visita no dia anterior)
-- 3. Atualizar registros únicos para o dia anterior
-- 4. Validar resultados
--
-- ============================================================================

-- Início da transação para garantir atomicidade
START TRANSACTION;

-- ============================================================================
-- PASSO 1: Criar tabela de backup dos registros afetados
-- ============================================================================
DROP TABLE IF EXISTS daily_visits_backup_timezone;

CREATE TABLE daily_visits_backup_timezone AS
SELECT 
  visit_date,
  visitor_hash,
  created_at,
  'BEFORE_MIGRATION' as status
FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15';

-- Adicionar informações sobre o que será feito com cada registro
ALTER TABLE daily_visits_backup_timezone ADD COLUMN migration_action VARCHAR(50);

UPDATE daily_visits_backup_timezone b
SET migration_action = CASE
  WHEN EXISTS (
    SELECT 1 FROM daily_visits d
    WHERE d.visitor_hash = b.visitor_hash
      AND d.visit_date = DATE_SUB(b.visit_date, INTERVAL 1 DAY)
      AND HOUR(d.created_at) NOT BETWEEN 0 AND 2
  ) THEN 'DELETE_DUPLICATE'
  ELSE 'MOVE_TO_PREVIOUS_DAY'
END;

-- ============================================================================
-- PASSO 2: Deletar registros duplicados
-- ============================================================================
-- Estes são registros onde o usuário visitou tanto no horário correto
-- quanto no horário errado do mesmo dia. Mantemos apenas o registro correto.

DELETE FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15'
  AND EXISTS (
    SELECT 1 FROM daily_visits d2
    WHERE d2.visitor_hash = daily_visits.visitor_hash
      AND d2.visit_date = DATE_SUB(daily_visits.visit_date, INTERVAL 1 DAY)
      AND HOUR(d2.created_at) NOT BETWEEN 0 AND 2
  );

-- ============================================================================
-- PASSO 3: Mover registros únicos para o dia anterior
-- ============================================================================
-- Atualizar a data de visita para o dia anterior (GMT-3 correto)

UPDATE daily_visits
SET visit_date = DATE_SUB(visit_date, INTERVAL 1 DAY)
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15';

-- ============================================================================
-- PASSO 4: Validação dos resultados
-- ============================================================================

-- Verificar se ainda há registros com horário 0-2h UTC após migração
SELECT 
  COUNT(*) as registros_restantes_0_2h,
  'Se este número for 0, a migração foi bem-sucedida' as status
FROM daily_visits
WHERE HOUR(created_at) BETWEEN 0 AND 2
  AND visit_date >= '2025-10-15';

-- Estatísticas da migração
SELECT 
  migration_action,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM daily_visits_backup_timezone), 2) as percentual
FROM daily_visits_backup_timezone
GROUP BY migration_action;

-- Total antes e depois
SELECT 
  'ANTES DA MIGRAÇÃO' as momento,
  COUNT(*) as total_registros
FROM daily_visits_backup_timezone
UNION ALL
SELECT 
  'DEPOIS DA MIGRAÇÃO (deve ser menor)' as momento,
  COUNT(*) as total_registros
FROM daily_visits;

-- ============================================================================
-- IMPORTANTE: Revise os resultados antes de fazer COMMIT
-- ============================================================================
-- Se tudo estiver correto, execute: COMMIT;
-- Se algo der errado, execute: ROLLBACK;
-- ============================================================================

-- Aguardando revisão manual antes do commit final
-- Para confirmar: COMMIT;
-- Para reverter: ROLLBACK;

