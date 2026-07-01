import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Pool de conexões para melhor performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Função para testar a conexão
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com banco de dados estabelecida!');
    console.log(`📊 Conectado ao banco: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    
    // Testar se as tabelas existem
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'promotions'"
    );
    
    if (tables.length === 0) {
      console.warn('⚠️  Tabela "promotions" não encontrada no banco de dados');
    } else {
      console.log('✅ Tabela "promotions" encontrada');
    }
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com banco de dados:', error.message);
    throw error;
  }
}

// Função helper para executar queries
export async function query(sql, params = []) {
  try {
    // Usar query ao invés de execute para evitar problemas com prepared statements
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
}

// Função para obter uma conexão direta (para transações)
export async function getConnection() {
  return await pool.getConnection();
}

export default pool; 