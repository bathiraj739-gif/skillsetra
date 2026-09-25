const pool = require('../config/db');

async function createQuestion(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Duplicate check
    const dupCheck = await client.query(
      `SELECT id FROM questions WHERE question_text = $1 AND is_active = true`,
      [data.question_text]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error('DUPLICATE_QUESTION');
    }

    const result = await client.query(
      `INSERT INTO questions 
       (question_text, category, difficulty, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [
        data.question_text,
        data.category,
        data.difficulty,
        data.option_a,
        data.option_b,
        data.option_c,
        data.option_d,
        data.correct_option,
        data.marks
      ]
    );
    const question = result.rows[0];

    // Activity Log
    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'QUESTION_CREATED', 'question', question.id]
    );

    await client.query('COMMIT');
    return question;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getQuestions(filters) {
  const { category, difficulty, search, page = 1, limit = 20 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [];
  let whereClauses = ['is_active = true'];
  let paramIndex = 1;

  if (category) {
    whereClauses.push(`category = $${paramIndex}`);
    queryParams.push(category);
    paramIndex++;
  }

  if (difficulty) {
    whereClauses.push(`difficulty = $${paramIndex}`);
    queryParams.push(difficulty);
    paramIndex++;
  }

  if (search) {
    whereClauses.push(`question_text ILIKE $${paramIndex}`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM questions ${whereString}`;
  const countRes = await pool.query(countQuery, queryParams);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    SELECT id, question_text, category, difficulty, option_a, option_b, option_c, option_d, correct_option, marks, is_active, created_at, updated_at
    FROM questions
    ${whereString}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...queryParams, parsedLimit, offset]);

  return {
    questions: dataRes.rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  };
}

async function getQuestionById(id) {
  const result = await pool.query(
    `SELECT * FROM questions WHERE id = $1 AND is_active = true`,
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function updateQuestion(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify exists
    const qCheck = await client.query(`SELECT id FROM questions WHERE id = $1 AND is_active = true`, [id]);
    if (qCheck.rows.length === 0) {
      throw new Error('NOT_FOUND');
    }

    const result = await client.query(
      `UPDATE questions
       SET question_text = COALESCE($1, question_text),
           category = COALESCE($2, category),
           difficulty = COALESCE($3, difficulty),
           option_a = COALESCE($4, option_a),
           option_b = COALESCE($5, option_b),
           option_c = COALESCE($6, option_c),
           option_d = COALESCE($7, option_d),
           correct_option = COALESCE($8, correct_option),
           marks = COALESCE($9, marks),
           updated_at = NOW()
       WHERE id = $10 AND is_active = true
       RETURNING *`,
      [
        data.question_text,
        data.category,
        data.difficulty,
        data.option_a,
        data.option_b,
        data.option_c,
        data.option_d,
        data.correct_option,
        data.marks,
        id
      ]
    );

    const updated = result.rows[0];

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'QUESTION_UPDATED', 'question', updated.id]
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function softDeleteQuestion(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check references in assessment_questions, attempt_questions, answers
    const checkRefs = await client.query(`
      SELECT 1 FROM assessment_questions WHERE question_id = $1
      UNION
      SELECT 1 FROM attempt_questions WHERE question_id = $1
      UNION
      SELECT 1 FROM answers WHERE question_id = $1
    `, [id]);

    const result = await client.query(
      `UPDATE questions
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('NOT_FOUND');
    }

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'QUESTION_DELETED', 'question', id]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  softDeleteQuestion
};
