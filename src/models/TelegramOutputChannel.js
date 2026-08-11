import { v4 as uuidv4 } from 'uuid';
import { query, getConnection } from '../config/database.js';

class TelegramOutputChannel {
  static async findAll() {
    const channels = await query('SELECT * FROM telegram_output_channels ORDER BY created_at DESC');
    if (channels.length === 0) return [];

    const ids = channels.map((c) => c.id);
    const placeholders = ids.map(() => '?').join(',');
    const links = await query(
      `SELECT cc.channel_id, cc.category_id, c.name AS category_name
       FROM telegram_output_channel_categories cc
       JOIN categories c ON c.id = cc.category_id
       WHERE cc.channel_id IN (${placeholders})`,
      ids
    );

    const byChannel = new Map();
    for (const l of links) {
      if (!byChannel.has(l.channel_id)) byChannel.set(l.channel_id, []);
      byChannel.get(l.channel_id).push({ id: l.category_id, name: l.category_name });
    }

    return channels.map((c) => ({ ...c, categories: byChannel.get(c.id) || [] }));
  }

  static async findById(id) {
    const [channel] = await query('SELECT * FROM telegram_output_channels WHERE id = ?', [id]);
    if (!channel) return null;
    const categories = await query(
      `SELECT cc.category_id AS id, c.name
       FROM telegram_output_channel_categories cc
       JOIN categories c ON c.id = cc.category_id
       WHERE cc.channel_id = ?`,
      [id]
    );
    return { ...channel, categories };
  }

  static async create({ title, username }) {
    const id = uuidv4();
    await query(
      'INSERT INTO telegram_output_channels (id, title, username) VALUES (?, ?, ?)',
      [id, title, username || null]
    );
    return this.findById(id);
  }

  static async updateBasics(id, { title, username }) {
    await query(
      `UPDATE telegram_output_channels
       SET title = COALESCE(?, title),
           username = COALESCE(?, username),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title ?? null, username ?? null, id]
    );
    return this.findById(id);
  }

  static async setVerification(id, { status, chat_id, tg_title, member_count, last_error }) {
    await query(
      `UPDATE telegram_output_channels
       SET status = ?,
           chat_id = ?,
           tg_title = ?,
           member_count = ?,
           last_error = ?,
           verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE verified_at END,
           active = CASE WHEN ? = 'verified' THEN active ELSE 0 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, chat_id ?? null, tg_title ?? null, member_count ?? null, last_error ?? null, status, status, id]
    );
    return this.findById(id);
  }

  static async setActive(id, active) {
    await query(
      'UPDATE telegram_output_channels SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [active ? 1 : 0, id]
    );
    return this.findById(id);
  }

  static async setCategories(id, categoryIds) {
    const conn = await getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM telegram_output_channel_categories WHERE channel_id = ?', [id]);
      if (categoryIds.length > 0) {
        const values = categoryIds.map(() => '(?, ?)').join(',');
        const params = [];
        for (const catId of categoryIds) params.push(id, catId);
        await conn.query(
          `INSERT INTO telegram_output_channel_categories (channel_id, category_id) VALUES ${values}`,
          params
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return this.findById(id);
  }

  static async delete(id) {
    const result = await query('DELETE FROM telegram_output_channels WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async findTargetsForCategories(categoryIds) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];
    const placeholders = categoryIds.map(() => '?').join(',');
    const rows = await query(
      `SELECT DISTINCT c.id, c.chat_id, c.title, c.username
       FROM telegram_output_channels c
       JOIN telegram_output_channel_categories cc ON cc.channel_id = c.id
       WHERE c.active = 1
         AND c.status = 'verified'
         AND c.chat_id IS NOT NULL
         AND cc.category_id IN (${placeholders})`,
      categoryIds
    );
    return rows;
  }
}

export default TelegramOutputChannel;
