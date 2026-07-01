import { query } from '../config/database.js';

class SiteConfig {
  // Buscar configuração por chave (público)
  static async getByKey(key) {
    try {
      const sql = 'SELECT * FROM site_configs WHERE config_key = ?';
      const [config] = await query(sql, [key]);
      return config || null;
    } catch (error) {
      console.error('❌ Erro ao buscar configuração por chave:', error);
      throw error;
    }
  }

  // Buscar todas as configurações (admin)
  static async getAll() {
    try {
      const sql = 'SELECT * FROM site_configs ORDER BY config_key ASC';
      const configs = await query(sql);
      return configs;
    } catch (error) {
      console.error('❌ Erro ao buscar todas as configurações:', error);
      throw error;
    }
  }

  // Criar nova configuração (admin)
  static async create(data) {
    try {
      const { config_key, config_value, description } = data;
      
      const sql = `
        INSERT INTO site_configs (config_key, config_value, description)
        VALUES (?, ?, ?)
      `;
      
      const result = await query(sql, [config_key, config_value, description]);
      
      if (result.affectedRows === 0) {
        throw new Error('Erro ao criar configuração');
      }
      
      return await this.getByKey(config_key);
    } catch (error) {
      console.error('❌ Erro ao criar configuração:', error);
      throw error;
    }
  }

  // Atualizar configuração (admin)
  static async updateByKey(key, data) {
    try {
      const { config_value, description } = data;
      
      const sql = `
        UPDATE site_configs 
        SET config_value = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE config_key = ?
      `;
      
      const result = await query(sql, [config_value, description, key]);
      
      if (result.affectedRows === 0) {
        throw new Error('Configuração não encontrada');
      }
      
      return await this.getByKey(key);
    } catch (error) {
      console.error('❌ Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  // Deletar configuração (admin)
  static async deleteByKey(key) {
    try {
      const sql = 'DELETE FROM site_configs WHERE config_key = ?';
      const result = await query(sql, [key]);
      
      if (result.affectedRows === 0) {
        throw new Error('Configuração não encontrada');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar configuração:', error);
      throw error;
    }
  }

  // Buscar valor de configuração (helper method)
  static async getValue(key, defaultValue = null) {
    try {
      const config = await this.getByKey(key);
      return config ? config.config_value : defaultValue;
    } catch (error) {
      console.error('❌ Erro ao buscar valor da configuração:', error);
      return defaultValue;
    }
  }
}

export default SiteConfig;
