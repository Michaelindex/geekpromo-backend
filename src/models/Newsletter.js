import { query } from '../config/database.js';

class Newsletter {
  // Verificar controle de spam por IP
  static async checkSpam(ipAddress) {
    try {
      // Verificar se IP está bloqueado
      const checkBlockedSql = `
        SELECT blocked_until 
        FROM newsletter_spam_control 
        WHERE ip_address = ? AND blocked_until > NOW()
      `;
      const [blockedRecord] = await query(checkBlockedSql, [ipAddress]);
      
      if (blockedRecord) {
        return {
          isBlocked: true,
          message: 'IP temporariamente bloqueado. Tente novamente mais tarde.'
        };
      }

      // Verificar tentativas na última hora
      const checkAttemptsSql = `
        SELECT attempt_count, first_attempt 
        FROM newsletter_spam_control 
        WHERE ip_address = ? AND first_attempt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `;
      const [attemptRecord] = await query(checkAttemptsSql, [ipAddress]);
      
      if (attemptRecord && attemptRecord.attempt_count >= 2) {
        // Bloquear IP por 1 hora
        const blockSql = `
          UPDATE newsletter_spam_control 
          SET blocked_until = DATE_ADD(NOW(), INTERVAL 1 HOUR),
              last_attempt = NOW(),
              attempt_count = attempt_count + 1
          WHERE ip_address = ?
        `;
        await query(blockSql, [ipAddress]);
        
        return {
          isBlocked: true,
          message: 'Limite de tentativas excedido. IP bloqueado por 1 hora.'
        };
      }

      return { isBlocked: false };
    } catch (error) {
      console.error('❌ Erro ao verificar spam control:', error);
      throw error;
    }
  }

  // Atualizar controle de spam
  static async updateSpamControl(ipAddress) {
    try {
      // Verificar se já existe registro para este IP na última hora
      const checkSql = `
        SELECT id, attempt_count 
        FROM newsletter_spam_control 
        WHERE ip_address = ? AND first_attempt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `;
      const [existingRecord] = await query(checkSql, [ipAddress]);

      if (existingRecord) {
        // Atualizar contador existente
        const updateSql = `
          UPDATE newsletter_spam_control 
          SET attempt_count = attempt_count + 1, last_attempt = NOW()
          WHERE id = ?
        `;
        await query(updateSql, [existingRecord.id]);
      } else {
        // Criar novo registro ou resetar existente
        const insertSql = `
          INSERT INTO newsletter_spam_control (ip_address, attempt_count, first_attempt, last_attempt)
          VALUES (?, 1, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
          attempt_count = 1,
          first_attempt = NOW(),
          last_attempt = NOW(),
          blocked_until = NULL
        `;
        await query(insertSql, [ipAddress]);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar spam control:', error);
      throw error;
    }
  }

  // Limpar registros antigos de spam control (older than 2 hours)
  static async cleanupSpamControl() {
    try {
      const cleanupSql = `
        DELETE FROM newsletter_spam_control 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR) 
        AND (blocked_until IS NULL OR blocked_until < NOW())
      `;
      const result = await query(cleanupSql);
      console.log(`🧹 Limpeza spam control: ${result.affectedRows} registros removidos`);
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Erro ao limpar spam control:', error);
      throw error;
    }
  }

  // Inscrever e-mail na newsletter
  static async subscribe(emailData) {
    try {
      const { email, ipAddress, userAgent, source } = emailData;

      // 1. Verificar controle de spam
      const spamCheck = await this.checkSpam(ipAddress);
      if (spamCheck.isBlocked) {
        throw new Error(spamCheck.message);
      }

      // 2. Tentar inserir o e-mail
      const insertSql = `
        INSERT INTO newsletters (email, ip_address, user_agent, source)
        VALUES (?, ?, ?, ?)
      `;
      
      try {
        const result = await query(insertSql, [email, ipAddress, userAgent, source]);
        
        // 3. Atualizar controle de spam apenas se inserção foi bem-sucedida
        await this.updateSpamControl(ipAddress);
        
        // 4. Limpar registros antigos ocasionalmente (10% chance)
        if (Math.random() < 0.1) {
          await this.cleanupSpamControl();
        }
        
        console.log(`✅ Newsletter: E-mail ${email} inscrito com sucesso (source: ${source})`);
        
        return {
          id: result.insertId,
          email,
          source,
          subscribedAt: new Date()
        };
        
      } catch (dbError) {
        // Verificar se é erro de e-mail duplicado
        if (dbError.code === 'ER_DUP_ENTRY') {
          throw new Error('Este e-mail já está inscrito na nossa newsletter');
        }
        throw dbError;
      }
      
    } catch (error) {
      console.error('❌ Erro ao inscrever na newsletter:', error);
      throw error;
    }
  }

  // Buscar por e-mail (para verificações futuras)
  static async findByEmail(email) {
    try {
      const sql = 'SELECT * FROM newsletters WHERE email = ?';
      const [newsletter] = await query(sql, [email]);
      return newsletter || null;
    } catch (error) {
      console.error('❌ Erro ao buscar newsletter por e-mail:', error);
      throw error;
    }
  }

  // Estatísticas básicas (para uso futuro)
  static async getStats() {
    try {
      const statsSql = `
        SELECT 
          COUNT(*) as total_subscribers,
          COUNT(CASE WHEN DATE(subscribed_at) = CURDATE() THEN 1 END) as today_subscribers,
          COUNT(CASE WHEN subscribed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_subscribers,
          source,
          COUNT(*) as source_count
        FROM newsletters 
        GROUP BY source WITH ROLLUP
      `;
      
      const results = await query(statsSql);
      return results;
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }
}

export default Newsletter;
