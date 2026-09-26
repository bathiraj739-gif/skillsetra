const pool = require('../config/db');

function mapResultRow(row) {
  const score = parseFloat(row.score || 0);
  const totalMarks = parseInt(row.total_marks || 0, 10);
  const totalQuestions = parseInt(row.total_questions || row.total_marks || 0, 10);
  const correct = parseInt(row.correct_answers || 0, 10);
  const wrong = parseInt(row.wrong_answers || 0, 10);
  const unanswered = parseInt(row.unanswered != null ? row.unanswered : Math.max(0, totalQuestions - (correct + wrong)), 10);
  const timeTaken = parseInt(row.time_taken_seconds || 0, 10);
  const percentage = parseFloat(row.percentage || 0);
  const aptitudeScore = parseFloat(row.aptitude_score || 0);
  const verbalScore = parseFloat(row.verbal_score || 0);

  return {
    id: row.id,
    attempt_id: row.attempt_id,
    attemptId: row.attempt_id,
    student_id: row.student_id,
    studentId: row.student_id,
    assessment_id: row.assessment_id,
    assessmentId: row.assessment_id,
    score: score,
    total_score: score,
    totalMarks: totalMarks,
    total_marks: totalMarks,
    total_questions: totalQuestions,
    totalQuestions: totalQuestions,
    percentage: percentage,
    aptitude_score: aptitudeScore,
    aptitudeScore: aptitudeScore,
    verbal_score: verbalScore,
    verbalScore: verbalScore,
    correct_answers: correct,
    correctAnswers: correct,
    incorrect_answers: wrong,
    wrong_answers: wrong,
    wrongAnswers: wrong,
    unanswered: unanswered,
    time_taken_seconds: timeTaken,
    timeTakenSeconds: timeTaken,
    completed_at: row.completed_at || row.created_at,
    completedAt: row.completed_at || row.created_at,
    submitted_at: row.completed_at || row.created_at,
    created_at: row.created_at || row.completed_at,
    student_name: row.full_name,
    candidate_name: row.full_name,
    full_name: row.full_name,
    assessment: {
      id: row.assessment_id,
      title: row.assessment_title,
      description: row.assessment_description,
      duration_minutes: row.duration_minutes || 30,
      passing_percentage: 50
    },
    student: {
      id: row.student_id,
      name: row.full_name,
      full_name: row.full_name,
      fullName: row.full_name,
      register_number: row.register_number,
      registerNumber: row.register_number,
      department: row.department
    }
  };
}

const RESULT_SELECT_SQL = `
  SELECT 
    r.id,
    r.attempt_id,
    r.student_id,
    r.assessment_id,
    r.score,
    r.total_marks,
    r.percentage,
    r.correct_answers,
    r.wrong_answers,
    r.unanswered,
    r.completed_at,
    r.created_at,
    a.title AS assessment_title,
    a.description AS assessment_description,
    a.duration_minutes,
    s.register_number,
    s.full_name,
    s.department,
    COALESCE(
      EXTRACT(EPOCH FROM (att.submitted_at - att.started_at))::int,
      0
    ) AS time_taken_seconds,
    COALESCE((
      SELECT COUNT(*) 
      FROM attempt_questions aq 
      WHERE aq.attempt_id = r.attempt_id
    ), r.total_marks) AS total_questions,
    COALESCE((
      SELECT SUM(ans.marks_awarded)
      FROM answers ans
      JOIN questions q ON ans.question_id = q.id
      WHERE ans.attempt_id = r.attempt_id AND q.category = 'APTITUDE'
    ), 0) AS aptitude_score,
    COALESCE((
      SELECT SUM(ans.marks_awarded)
      FROM answers ans
      JOIN questions q ON ans.question_id = q.id
      WHERE ans.attempt_id = r.attempt_id AND q.category = 'VERBAL'
    ), 0) AS verbal_score
  FROM results r
  JOIN assessments a ON r.assessment_id = a.id
  JOIN students s ON r.student_id = s.id
  LEFT JOIN attempts att ON r.attempt_id = att.id
`;

// Admin logic
async function getResults(filters) {
  const { assessmentId, studentId, search, page = 1, limit = 20 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [];
  let whereClauses = [];
  let paramIndex = 1;

  if (assessmentId) {
    whereClauses.push(`r.assessment_id = $${paramIndex++}`);
    queryParams.push(assessmentId);
  }
  if (studentId) {
    whereClauses.push(`r.student_id = $${paramIndex++}`);
    queryParams.push(studentId);
  }
  if (search) {
    whereClauses.push(`(s.full_name ILIKE $${paramIndex} OR s.register_number ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) FROM results r
    JOIN students s ON r.student_id = s.id
    ${whereString}
  `;
  const countRes = await pool.query(countQuery, queryParams);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    ${RESULT_SELECT_SQL}
    ${whereString}
    ORDER BY r.completed_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...queryParams, parsedLimit, offset]);

  return {
    results: dataRes.rows.map(mapResultRow),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  };
}

async function getAnswerReportForAttempt(attemptId) {
  const query = `
    SELECT 
      aq.question_order,
      q.id AS question_id,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_option,
      q.marks AS question_marks,
      ans.selected_option,
      ans.is_correct,
      ans.marks_awarded
    FROM attempt_questions aq
    JOIN questions q ON aq.question_id = q.id
    LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
    WHERE aq.attempt_id = $1
    ORDER BY aq.question_order ASC
  `;
  const res = await pool.query(query, [attemptId]);

  return res.rows.map((row, idx) => {
    const selectedOpt = row.selected_option ? row.selected_option.trim() : null;
    const correctOpt = row.correct_option ? row.correct_option.trim() : null;
    const questionMarks = parseInt(row.question_marks || 1, 10);
    const marksAwarded = parseFloat(row.marks_awarded || 0);

    let status = 'Unanswered';
    if (selectedOpt) {
      if (row.is_correct === true || selectedOpt === correctOpt) {
        status = 'Correct';
      } else {
        status = 'Wrong';
      }
    }

    return {
      question_number: row.question_order || (idx + 1),
      question_id: row.question_id,
      question_text: row.question_text,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      selected_option: selectedOpt,
      correct_option: correctOpt,
      status: status,
      marks_awarded: marksAwarded,
      question_marks: questionMarks
    };
  });
}

async function getResultById(id) {
  const query = `
    ${RESULT_SELECT_SQL}
    WHERE r.id = $1 OR r.attempt_id = $1
  `;
  const res = await pool.query(query, [id]);
  if (res.rows.length === 0) return null;
  const mapped = mapResultRow(res.rows[0]);
  mapped.answer_report = await getAnswerReportForAttempt(res.rows[0].attempt_id);
  return mapped;
}

// Student logic
async function getStudentResults(studentUserId) {
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const query = `
    ${RESULT_SELECT_SQL}
    WHERE r.student_id = $1
    ORDER BY r.completed_at DESC
  `;
  const dataRes = await pool.query(query, [studentId]);

  return dataRes.rows.map(mapResultRow);
}

async function getStudentResultById(id, studentUserId) {
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const query = `
    ${RESULT_SELECT_SQL}
    WHERE (r.id = $1 OR r.attempt_id = $1)
  `;
  const res = await pool.query(query, [id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  if (row.student_id !== studentId) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

  const mapped = mapResultRow(row);
  mapped.answer_report = await getAnswerReportForAttempt(row.attempt_id);
  return mapped;
}

async function getStudentAttemptReport(attemptId, studentUserId) {
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const attemptRes = await pool.query(
    `SELECT id, student_id, status FROM attempts WHERE id = $1 OR id = (SELECT attempt_id FROM results WHERE id = $1)`,
    [attemptId]
  );
  if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
  const attempt = attemptRes.rows[0];

  if (attempt.student_id !== studentId) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

  if (attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED') {
    throw new Error('ATTEMPT_NOT_COMPLETED');
  }

  return await getAnswerReportForAttempt(attempt.id);
}

module.exports = {
  getResults,
  getResultById,
  getStudentResults,
  getStudentResultById,
  getStudentAttemptReport
};

