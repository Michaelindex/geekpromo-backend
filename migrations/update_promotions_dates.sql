-- ===========================================
-- MIGRAÇÃO: SISTEMA DE DATAS E HORÁRIOS
-- Versão: 1.0
-- Data: 2024-12-22
-- ===========================================

-- 1. Adicionar novo status 'scheduled' ao ENUM
ALTER TABLE promotions 
MODIFY COLUMN status ENUM('draft', 'scheduled', 'published', 'expired') DEFAULT 'draft';

-- 2. Tornar starts_at opcional (pode ser NULL)
ALTER TABLE promotions 
MODIFY COLUMN starts_at TIMESTAMP NULL;

-- 3. Adicionar índices para otimizar performance das consultas por data
CREATE INDEX IF NOT EXISTS idx_promotions_scheduled ON promotions(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_promotions_status_dates ON promotions(status, starts_at, expires_at);

-- 4. Atualizar promoções existentes para o novo formato
-- Promoções publicadas sem data de início específica mantêm starts_at como NULL
UPDATE promotions 
SET starts_at = NULL 
WHERE status = 'published' AND starts_at = created_at;

-- 5. Verificar integridade dos dados
-- Esta consulta deve retornar 0 registros após a migração
SELECT COUNT(*) as problemas_encontrados 
FROM promotions 
WHERE (status = 'scheduled' AND starts_at IS NULL)
   OR (status = 'published' AND expires_at < NOW())
   OR (expires_at <= starts_at AND starts_at IS NOT NULL);

-- 6. Criar função para verificar status baseado em datas (opcional - para referência)
-- Esta será implementada no código Node.js, mas deixo aqui para documentação

/*
DELIMITER //
CREATE FUNCTION get_promotion_status(
    current_status VARCHAR(20),
    starts_at_param TIMESTAMP,
    expires_at_param TIMESTAMP
) 
RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE current_time TIMESTAMP DEFAULT NOW();
    
    -- Se expirou, sempre 'expired'
    IF expires_at_param < current_time THEN
        RETURN 'expired';
    END IF;
    
    -- Se tem data de início e ainda não chegou, 'scheduled'
    IF starts_at_param IS NOT NULL AND starts_at_param > current_time THEN
        RETURN 'scheduled';
    END IF;
    
    -- Se chegou aqui e status é draft, continua draft
    IF current_status = 'draft' THEN
        RETURN 'draft';
    END IF;
    
    -- Caso contrário, está ativo
    RETURN 'published';
END//
DELIMITER ;
*/

-- 7. Comentários para referência futura
-- starts_at = NULL: Promoção sem agendamento (publica imediatamente)
-- starts_at > NOW(): Promoção agendada (status = 'scheduled')
-- starts_at <= NOW() AND expires_at > NOW(): Promoção ativa (status = 'published')
-- expires_at <= NOW(): Promoção expirada (status = 'expired')
