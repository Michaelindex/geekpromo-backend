-- Adicionar campo description na tabela promotions
-- Permite HTML formatado para descrições ricas dos produtos

ALTER TABLE promotions ADD COLUMN description TEXT NULL AFTER partner_url;

-- Adicionar índice para otimizar consultas que filtram por descrição
CREATE INDEX idx_promotions_description ON promotions(description(255));

-- Comentário para documentar o campo
ALTER TABLE promotions MODIFY COLUMN description TEXT NULL COMMENT 'Descrição HTML do produto com formatação rica';
