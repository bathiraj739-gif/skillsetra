const pool = require('../config/db');

async function _validateQuestionsAndGetMarks(client, questionIds) {
  if (!questionIds || questionIds.length === 0) {
    throw new Error('AT_LEAST_ONE_QUESTION_REQUIRED');
  }

  // Remove duplicate IDs
  const uniqueIds = [...new Set(questionIds)];

  const { rows } = await client.query(
    `SELECT id, category, marks, is_active FROM questions WHERE id = ANY($1::uuid[]) AND is_active = true`,
    [uniqueIds]
  );

  if (rows.length !== uniqueIds.length) {
    throw new Error('INVALID_OR_INACTIVE_QUESTION_INCLUDED');
  }

  let totalMarks = 0;
  for (const row of rows) {
    if (row.category !== 'APTITUDE' && row.category !== 'VERBAL') {
      throw new Error('UNSUPPORTED_QUESTION_CATEGORY');
    }
    totalMarks += row.marks;
  }

  return { uniqueIds, totalMarks };
}

async function createAssessment(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { uniqueIds, totalMarks } = await _validateQuestionsAndGetMarks(client, data.questionIds);

    const assessmentRes = await client.query(
      `INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5) RETURNING *`,
      [data.title, data.description || null, data.durationMinutes, totalMarks, userId]
    );

    const assessment = assessmentRes.rows[0];

    // Insert assessment_questions
    // questionIds defines the order
    const orderedIds = [...new Set(data.questionIds)]; // ensure uniqueness but keep array order
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `INSERT INTO assessment_questions (assessment_id, question_id, question_order) VALUES ($1, $2, $3)`,
        [assessment.id, orderedIds[i], i + 1]
      );
    }

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'ASSESSMENT_CREATED', 'assessment', assessment.id]
    );

    await client.query('COMMIT');
    return assessment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAssessments(filters) {
  const { status, search, page = 1, limit = 20 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [];
  let whereClauses = [];
  let paramIndex = 1;

  if (status) {
    whereClauses.push(`status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  if (search) {
    whereClauses.push(`title ILIKE $${paramIndex}`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM assessments ${whereString}`;
  const countRes = await pool.query(countQuery, queryParams);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    SELECT a.id, a.title, a.description, a.duration_minutes, a.total_marks, a.status, a.created_by, a.created_at, a.updated_at,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id), 0) as question_count,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'APTITUDE'), 0) as aptitude_count,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'VERBAL'), 0) as verbal_count
    FROM assessments a
    ${whereString}
    ORDER BY a.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...queryParams, parsedLimit, offset]);

  return {
    assessments: dataRes.rows.map(row => ({
      ...row,
      question_count: parseInt(row.question_count, 10),
      aptitude_count: parseInt(row.aptitude_count || 0, 10),
      verbal_count: parseInt(row.verbal_count || 0, 10),
    })),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  };
}

async function getAssessmentById(id) {
  const assRes = await pool.query(`
    SELECT a.*,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id), 0) as question_count,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'APTITUDE'), 0) as aptitude_count,
           COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'VERBAL'), 0) as verbal_count
    FROM assessments a WHERE a.id = $1
  `, [id]);
  if (assRes.rows.length === 0) return null;

  const assessment = assRes.rows[0];

  const qRes = await pool.query(
    `SELECT q.id, q.question_text, q.category, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.marks, aq.question_order
     FROM assessment_questions aq
     JOIN questions q ON aq.question_id = q.id
     WHERE aq.assessment_id = $1
     ORDER BY aq.question_order ASC`,
    [id]
  );

  return {
    ...assessment,
    question_count: parseInt(assessment.question_count || 0, 10),
    aptitude_count: parseInt(assessment.aptitude_count || 0, 10),
    verbal_count: parseInt(assessment.verbal_count || 0, 10),
    questions: qRes.rows
  };
}

async function updateAssessment(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assRes = await client.query(`SELECT * FROM assessments WHERE id = $1`, [id]);
    if (assRes.rows.length === 0) throw new Error('NOT_FOUND');
    const current = assRes.rows[0];

    const durationMinutes = data.durationMinutes != null ? Number(data.durationMinutes) : (data.duration_minutes != null ? Number(data.duration_minutes) : current.duration_minutes);
    const questionIds = data.questionIds || data.question_ids;
    const status = data.status ? String(data.status).toUpperCase() : current.status;

    // Check if attempts exist
    const attemptCheck = await client.query(`SELECT 1 FROM attempts WHERE assessment_id = $1 LIMIT 1`, [id]);
    if (attemptCheck.rows.length > 0 && questionIds) {
      throw new Error('ATTEMPTS_EXIST');
    }

    let totalMarks = current.total_marks;
    if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
      const res = await _validateQuestionsAndGetMarks(client, questionIds);
      totalMarks = res.totalMarks;

      await client.query(`DELETE FROM assessment_questions WHERE assessment_id = $1`, [id]);

      const orderedIds = [...new Set(questionIds)];
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          `INSERT INTO assessment_questions (assessment_id, question_id, question_order) VALUES ($1, $2, $3)`,
          [id, orderedIds[i], i + 1]
        );
      }
    }

    const updatedRes = await client.query(
      `UPDATE assessments
       SET title = COALESCE($1, title),
           description = $2,
           duration_minutes = $3,
           total_marks = $4,
           status = $5,
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        data.title || current.title,
        data.description !== undefined ? data.description : current.description,
        durationMinutes,
        totalMarks,
        status,
        id
      ]
    );

    const updated = updatedRes.rows[0];

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'ASSESSMENT_UPDATED', 'assessment', id]
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

async function publishAssessment(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assRes = await client.query(`SELECT * FROM assessments WHERE id = $1`, [id]);
    if (assRes.rows.length === 0) throw new Error('NOT_FOUND');
    
    const assessment = assRes.rows[0];
    if (assessment.status !== 'DRAFT') throw new Error('NOT_DRAFT');
    
    if (assessment.total_marks <= 0 || assessment.duration_minutes <= 0 || !assessment.title) {
      throw new Error('INVALID_ASSESSMENT_CONFIG');
    }

    const qCountRes = await client.query(`SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = $1`, [id]);
    if (parseInt(qCountRes.rows[0].count, 10) === 0) {
      throw new Error('NO_QUESTIONS');
    }

    // Check if any linked questions are inactive
    const inactiveCheck = await client.query(
      `SELECT q.id FROM assessment_questions aq 
       JOIN questions q ON aq.question_id = q.id 
       WHERE aq.assessment_id = $1 AND q.is_active = false LIMIT 1`, 
      [id]
    );
    if (inactiveCheck.rows.length > 0) throw new Error('CONTAINS_INACTIVE_QUESTIONS');

    const result = await client.query(
      `UPDATE assessments SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'ASSESSMENT_PUBLISHED', 'assessment', id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function closeAssessment(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assRes = await client.query(`SELECT status FROM assessments WHERE id = $1`, [id]);
    if (assRes.rows.length === 0) throw new Error('NOT_FOUND');
    if (assRes.rows[0].status !== 'PUBLISHED') throw new Error('NOT_PUBLISHED');

    const result = await client.query(
      `UPDATE assessments SET status = 'CLOSED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'ASSESSMENT_CLOSED', 'assessment', id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteAssessment(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assRes = await client.query(`SELECT status FROM assessments WHERE id = $1`, [id]);
    if (assRes.rows.length === 0) throw new Error('NOT_FOUND');

    const refs = await client.query(`
      SELECT 1 FROM assessment_assignments WHERE assessment_id = $1
      UNION
      SELECT 1 FROM attempts WHERE assessment_id = $1
      UNION
      SELECT 1 FROM results WHERE assessment_id = $1
    `, [id]);

    if (refs.rows.length > 0) throw new Error('ASSESSMENT_IN_USE');

    await client.query(`DELETE FROM assessment_questions WHERE assessment_id = $1`, [id]);
    await client.query(`DELETE FROM assessments WHERE id = $1`, [id]);

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [userId, 'ASSESSMENT_DELETED', 'assessment', id]
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
  createAssessment,
  getAssessments,
  getAssessmentById,
  updateAssessment,
  publishAssessment,
  closeAssessment,
  deleteAssessment
};
