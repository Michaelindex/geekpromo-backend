-- Migration para criar tabela newsletters
CREATE TABLE IF NOT EXISTS newsletters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  source VARCHAR(100), -- 'footer', 'home_banner', 'promotion_page', etc.
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_ip_address (ip_address),
  INDEX idx_subscribed_at (subscribed_at),
  INDEX idx_source (source)
);

-- Inserir configuração exemplo se não existir
INSERT IGNORE INTO newsletters (email, ip_address, user_agent, source) 
VALUES ('teste@exemplo.com', '127.0.0.1', 'Mozilla/5.0', 'test');
