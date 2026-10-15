const pool = require('../config/db');

/**
 * AI Training Service
 * CRUD operations for admin-managed AI training knowledge entries.
 */

async function listTrainingData({ category, isActive, search, page = 1, limit = 50 }) {
  let sql = `SELECT id, title, category, content, is_active, priority, created_at, updated_at FROM ai_training_data`;
  const values = [];
  const conditions = [];

  if (category) {
    conditions.push(`category = $${values.length + 1}`);
    values.push(category.toUpperCase());
  }
  if (typeof isActive === 'boolean') {
    conditions.push(`is_active = $${values.length + 1}`);
    values.push(isActive);
  }
  if (search && search.trim()) {
    conditions.push(`(title ILIKE $${values.length + 1} OR content ILIKE $${values.length + 1})`);
    values.push(`%${search.trim()}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY priority DESC, created_at DESC';

  // Count total
  const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as count FROM').replace(/ORDER BY.+$/, '');
  const countRes = await pool.query(countSql, values);
  const total = parseInt(countRes.rows[0].count, 10);

  // Paginate
  const offset = (page - 1) * limit;
  sql += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const res = await pool.query(sql, values);
  return {
    entries: res.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

async function getTrainingEntry(id) {
  const res = await pool.query(
    `SELECT id, title, category, content, is_active, priority, created_at, updated_at FROM ai_training_data WHERE id = $1`,
    [id]
  );
  if (res.rows.length === 0) {
    const err = new Error('Training entry not found.');
    err.statusCode = 404;
    throw err;
  }
  return res.rows[0];
}

async function createTrainingEntry({ title, category, content, priority, userId }) {
  const res = await pool.query(
    `INSERT INTO ai_training_data (title, category, content, priority, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, category, content, is_active, priority, created_at, updated_at`,
    [title, category || 'GENERAL', content, priority || 0, userId]
  );
  return res.rows[0];
}

async function updateTrainingEntry(id, { title, category, content, isActive, priority }) {
  const existing = await getTrainingEntry(id);
  const res = await pool.query(
    `UPDATE ai_training_data
     SET title = $1, category = $2, content = $3, is_active = $4, priority = $5
     WHERE id = $6
     RETURNING id, title, category, content, is_active, priority, created_at, updated_at`,
    [
      title !== undefined ? title : existing.title,
      category !== undefined ? category : existing.category,
      content !== undefined ? content : existing.content,
      isActive !== undefined ? isActive : existing.is_active,
      priority !== undefined ? priority : existing.priority,
      id
    ]
  );
  return res.rows[0];
}

async function deleteTrainingEntry(id) {
  await getTrainingEntry(id); // ensure exists
  await pool.query(`DELETE FROM ai_training_data WHERE id = $1`, [id]);
  return { deleted: true };
}

async function toggleTrainingEntry(id) {
  const existing = await getTrainingEntry(id);
  const newActive = !existing.is_active;
  const res = await pool.query(
    `UPDATE ai_training_data SET is_active = $1 WHERE id = $2
     RETURNING id, title, category, content, is_active, priority, created_at, updated_at`,
    [newActive, id]
  );
  return res.rows[0];
}

/**
 * Get all active training data as a formatted prompt supplement
 * for injection into the AI Agent's system prompt.
 */
async function getActiveTrainingPrompt() {
  const res = await pool.query(
    `SELECT title, category, content FROM ai_training_data
     WHERE is_active = true
     ORDER BY priority DESC, created_at ASC`
  );

  if (res.rows.length === 0) return '';

  const lines = res.rows.map((row, i) => {
    return `[${i + 1}] (${row.category}) ${row.title}:\n${row.content}`;
  });

  return `\n\nADMIN-TRAINED CUSTOM KNOWLEDGE & INSTRUCTIONS:\nThe following entries were added by the Admin to customize your behavior and knowledge. Follow these instructions and incorporate this knowledge when relevant:\n---\n${lines.join('\n---\n')}\n---\n`;
}

async function getTrainingStats() {
  const res = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      COUNT(*) FILTER (WHERE is_active = false) as inactive,
      COUNT(DISTINCT category) as categories
    FROM ai_training_data
  `);
  const row = res.rows[0];
  return {
    total: parseInt(row.total, 10),
    active: parseInt(row.active, 10),
    inactive: parseInt(row.inactive, 10),
    categories: parseInt(row.categories, 10)
  };
}

module.exports = {
  listTrainingData,
  getTrainingEntry,
  createTrainingEntry,
  updateTrainingEntry,
  deleteTrainingEntry,
  toggleTrainingEntry,
  getActiveTrainingPrompt,
  getTrainingStats
};
