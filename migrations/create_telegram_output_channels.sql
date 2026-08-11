CREATE TABLE IF NOT EXISTS telegram_output_channels (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  username VARCHAR(64) DEFAULT NULL,
  chat_id VARCHAR(64) DEFAULT NULL,
  tg_title VARCHAR(255) DEFAULT NULL,
  member_count INT DEFAULT NULL,
  status ENUM('pending', 'verified', 'failed') NOT NULL DEFAULT 'pending',
  active TINYINT(1) NOT NULL DEFAULT 0,
  last_error VARCHAR(500) DEFAULT NULL,
  verified_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_username (username),
  INDEX idx_active_status (active, status)
);

CREATE TABLE IF NOT EXISTS telegram_output_channel_categories (
  channel_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (channel_id, category_id),
  INDEX idx_category (category_id),
  CONSTRAINT fk_toc_channel FOREIGN KEY (channel_id) REFERENCES telegram_output_channels (id) ON DELETE CASCADE,
  CONSTRAINT fk_toc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);
