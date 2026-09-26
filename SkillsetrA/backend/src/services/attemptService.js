const pool = require('../config/db');
const { emitToAdmin } = require('../socket');

// Helper to shuffle array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function checkAndHandleExpiration(attemptId, studentUserId) {
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const attemptRes = await pool.query(
    `SELECT a.id, a.student_id, a.status, a.started_at, a.submitted_at, ass.duration_minutes
     FROM attempts a
     JOIN assessments ass ON a.assessment_id = ass.id
     WHERE a.id = $1`,
    [attemptId]
  );
  if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
  const attempt = attemptRes.rows[0];

  if (attempt.student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');

  const durationMinutes = parseInt(attempt.duration_minutes || 30, 10);
  const startedAtMs = new Date(attempt.started_at).getTime();
  const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);
  const nowMs = Date.now();
  const isExpired = nowMs >= expiresAtMs;
  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

  if (isExpired && (attempt.status === 'IN_PROGRESS' || attempt.status === 'NOT_STARTED')) {
    const submitResult = await submitAttempt(attempt.id, studentUserId, 'AUTO_SUBMITTED');
    return {
      attemptId: attempt.id,
      status: 'AUTO_SUBMITTED',
      startedAt: attempt.started_at,
      submittedAt: submitResult.result?.completed_at || new Date().toISOString(),
      durationMinutes,
      expiresAt: new Date(expiresAtMs).toISOString(),
      remainingSeconds: 0,
      isExpired: true,
      autoSubmitted: true,
      result: submitResult.result
    };
  }

  return {
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    durationMinutes,
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingSeconds: (attempt.status === 'IN_PROGRESS' || attempt.status === 'NOT_STARTED') ? remainingSeconds : 0,
    isExpired
  };
}

async function startAttempt(assignmentOrAssessmentId, studentUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve studentId
    const studentRes = await client.query(`SELECT id, full_name, register_number FROM students WHERE user_id = $1`, [studentUserId]);
    if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    const student = studentRes.rows[0];
    const studentId = student.id;

    // Validate assignment - resolve by assignment ID or assessment ID
    let assignmentRes = await client.query(
      `SELECT a.id, a.assessment_id, a.status, a.due_at, ass.total_marks, ass.title, ass.duration_minutes
       FROM assessment_assignments a
       JOIN assessments ass ON a.assessment_id = ass.id
       WHERE (a.id = $1 OR a.assessment_id = $1) AND a.student_id = $2`,
      [assignmentOrAssessmentId, studentId]
    );

    if (assignmentRes.rows.length === 0) {
      const checkAny = await client.query(`SELECT 1 FROM assessment_assignments WHERE id = $1 OR assessment_id = $1`, [assignmentOrAssessmentId]);
      if (checkAny.rows.length > 0) {
        throw new Error('UNAUTHORIZED_ACCESS');
      }
      throw new Error('ASSIGNMENT_NOT_FOUND');
    }
    
    const assignment = assignmentRes.rows[0];
    const assignmentId = assignment.id;

    if (assignment.status === 'EXPIRED' || (assignment.due_at && new Date(assignment.due_at) < new Date())) {
      throw new Error('ASSIGNMENT_EXPIRED');
    }
    if (assignment.status === 'COMPLETED') {
      throw new Error('ASSIGNMENT_COMPLETED');
    }

    // Check if attempt already exists
    const existingAttempt = await client.query(
      `SELECT * FROM attempts WHERE assignment_id = $1`,
      [assignmentId]
    );
    if (existingAttempt.rows.length > 0) {
      const existing = existingAttempt.rows[0];
      const durationMinutes = parseInt(assignment.duration_minutes || 30, 10);
      const startedAtMs = new Date(existing.started_at).getTime();
      const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);
      const nowMs = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));

      if (nowMs >= expiresAtMs && (existing.status === 'IN_PROGRESS' || existing.status === 'NOT_STARTED')) {
        await client.query('COMMIT');
        const autoSub = await submitAttempt(existing.id, studentUserId, 'AUTO_SUBMITTED');
        return {
          ...existing,
          status: 'AUTO_SUBMITTED',
          submitted_at: autoSub.result?.completed_at,
          remaining_seconds: 0,
          expires_at: new Date(expiresAtMs).toISOString(),
          assessment: {
            id: assignment.assessment_id,
            title: assignment.title,
            duration_minutes: assignment.duration_minutes,
            total_marks: assignment.total_marks
          }
        };
      }

      if (existing.status === 'IN_PROGRESS' || existing.status === 'NOT_STARTED') {
        await client.query('COMMIT');
        return {
          ...existing,
          remaining_seconds: remainingSeconds,
          expires_at: new Date(expiresAtMs).toISOString(),
          assessment: {
            id: assignment.assessment_id,
            title: assignment.title,
            duration_minutes: assignment.duration_minutes,
            total_marks: assignment.total_marks
          }
        };
      }
      throw new Error('ATTEMPT_ALREADY_STARTED');
    }

    // Create attempt
    const attemptRes = await client.query(
      `INSERT INTO attempts (assessment_id, student_id, assignment_id, status, total_marks, started_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', $4, NOW())
       RETURNING *`,
      [assignment.assessment_id, studentId, assignmentId, assignment.total_marks]
    );
    const attempt = attemptRes.rows[0];

    // Update assignment status
    await client.query(
      `UPDATE assessment_assignments SET status = 'IN_PROGRESS' WHERE id = $1`,
      [assignmentId]
    );

    // Fetch assessment questions
    const qRes = await client.query(
      `SELECT question_id FROM assessment_questions WHERE assessment_id = $1`,
      [assignment.assessment_id]
    );
    const questions = qRes.rows.map(r => r.question_id);

    // Randomize
    shuffleArray(questions);

    // Insert into attempt_questions to fix the order
    for (let i = 0; i < questions.length; i++) {
      await client.query(
        `INSERT INTO attempt_questions (attempt_id, question_id, question_order)
         VALUES ($1, $2, $3)`,
        [attempt.id, questions[i], i + 1]
      );
    }

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [
        studentUserId,
        'ATTEMPT_STARTED',
        'attempt',
        attempt.id,
        JSON.stringify({
          studentName: student.full_name,
          registerNumber: student.register_number,
          assessmentTitle: assignment.title
        })
      ]
    );

    await client.query('COMMIT');

    const durationMinutes = parseInt(assignment.duration_minutes || 30, 10);
    const startedAtMs = new Date(attempt.started_at).getTime();
    const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);

    // Notify connected Live Monitoring dashboards
    emitToAdmin('student_started', {
      attemptId: attempt.id,
      studentId: studentId,
      studentName: student.full_name,
      registerNumber: student.register_number,
      assessmentId: assignment.assessment_id,
      assessmentTitle: assignment.title,
      timestamp: new Date()
    });

    return {
      ...attempt,
      remaining_seconds: durationMinutes * 60,
      expires_at: new Date(expiresAtMs).toISOString(),
      assessment: {
        id: assignment.assessment_id,
        title: assignment.title,
        duration_minutes: assignment.duration_minutes,
        total_marks: assignment.total_marks
      }
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAttemptQuestions(attemptId, studentUserId) {
  const statusInfo = await checkAndHandleExpiration(attemptId, studentUserId);
  if (statusInfo.isExpired || (statusInfo.status !== 'IN_PROGRESS' && statusInfo.status !== 'NOT_STARTED')) {
    throw new Error('ATTEMPT_EXPIRED');
  }

  // Resolve studentId
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  // Validate ownership
  const attemptRes = await pool.query(
    `SELECT student_id, status FROM attempts WHERE id = $1`,
    [attemptId]
  );
  if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
  if (attemptRes.rows[0].student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');

  // Fetch ordered questions
  const qRes = await pool.query(
    `SELECT 
      aq.question_order,
      q.id, q.question_text, q.category, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.marks,
      a.selected_option
     FROM attempt_questions aq
     JOIN questions q ON aq.question_id = q.id
     LEFT JOIN answers a ON a.attempt_id = aq.attempt_id AND a.question_id = aq.question_id
     WHERE aq.attempt_id = $1
     ORDER BY aq.question_order ASC`,
    [attemptId]
  );

  return qRes.rows;
}

async function saveAnswer(attemptId, questionId, selectedOption, studentUserId) {
  const statusInfo = await checkAndHandleExpiration(attemptId, studentUserId);
  if (statusInfo.isExpired || statusInfo.status !== 'IN_PROGRESS') {
    throw new Error('ATTEMPT_EXPIRED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve studentId
    const studentRes = await client.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
    if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    const studentId = studentRes.rows[0].id;

    // Validate attempt
    const attemptRes = await client.query(
      `SELECT student_id, status FROM attempts WHERE id = $1`,
      [attemptId]
    );
    if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
    const attempt = attemptRes.rows[0];

    if (attempt.student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');
    if (attempt.status !== 'IN_PROGRESS') throw new Error('ATTEMPT_NOT_IN_PROGRESS');

    // Validate question belongs to this attempt
    const aqRes = await client.query(
      `SELECT 1 FROM attempt_questions WHERE attempt_id = $1 AND question_id = $2`,
      [attemptId, questionId]
    );
    if (aqRes.rows.length === 0) throw new Error('QUESTION_NOT_IN_ATTEMPT');

    // Fetch correct answer for auto-evaluation
    const qRes = await client.query(
      `SELECT correct_option, marks FROM questions WHERE id = $1`,
      [questionId]
    );
    const question = qRes.rows[0];

    const isCorrect = selectedOption ? (selectedOption === question.correct_option) : null;
    const marksAwarded = isCorrect ? question.marks : 0;

    // Upsert answer
    await client.query(
      `INSERT INTO answers (attempt_id, question_id, selected_option, is_correct, marks_awarded, answered_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (attempt_id, question_id) 
       DO UPDATE SET 
         selected_option = EXCLUDED.selected_option,
         is_correct = EXCLUDED.is_correct,
         marks_awarded = EXCLUDED.marks_awarded,
         updated_at = NOW()`,
      [attemptId, questionId, selectedOption, isCorrect, marksAwarded]
    );

    await client.query('COMMIT');

    emitToAdmin('answer_saved', {
      attemptId,
      questionId,
      selectedOption,
      timestamp: new Date()
    });

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function submitAttempt(attemptId, studentUserId, targetStatus = 'SUBMITTED') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve studentId
    const studentRes = await client.query(`SELECT id, full_name, register_number FROM students WHERE user_id = $1`, [studentUserId]);
    if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    const student = studentRes.rows[0];
    const studentId = student.id;

    // Validate attempt with lock
    const attemptRes = await client.query(
      `SELECT student_id, status, assignment_id, assessment_id, total_marks, score FROM attempts WHERE id = $1 FOR UPDATE`,
      [attemptId]
    );
    if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
    const attempt = attemptRes.rows[0];

    if (attempt.student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');

    // IDEMPOTENCY: If already submitted/auto_submitted, return existing result without error
    if (attempt.status === 'SUBMITTED' || attempt.status === 'AUTO_SUBMITTED') {
      const existingResultRes = await client.query(`SELECT * FROM results WHERE attempt_id = $1`, [attemptId]);
      await client.query('COMMIT');
      return {
        id: attemptId,
        status: attempt.status,
        score: attempt.score,
        result: existingResultRes.rows[0] || null
      };
    }

    // Get total number of questions for this attempt
    const aqRes = await client.query(
      `SELECT COUNT(*) as total_qs FROM attempt_questions WHERE attempt_id = $1`,
      [attemptId]
    );
    const totalQs = parseInt(aqRes.rows[0].total_qs, 10);

    // Get stats from answers
    const statsRes = await client.query(
      `SELECT 
         COUNT(CASE WHEN is_correct = true THEN 1 END) as correct_answers,
         COUNT(CASE WHEN is_correct = false THEN 1 END) as wrong_answers,
         COALESCE(SUM(marks_awarded), 0) as score
       FROM answers WHERE attempt_id = $1`,
      [attemptId]
    );
    const stats = statsRes.rows[0];
    const correctAnswers = parseInt(stats.correct_answers, 10);
    const wrongAnswers = parseInt(stats.wrong_answers, 10);
    const score = parseFloat(stats.score);
    const unanswered = Math.max(0, totalQs - (correctAnswers + wrongAnswers));
    const percentage = attempt.total_marks > 0 ? (score / attempt.total_marks) * 100 : 0;

    const finalStatus = targetStatus === 'AUTO_SUBMITTED' ? 'AUTO_SUBMITTED' : 'SUBMITTED';

    // Update attempt
    await client.query(
      `UPDATE attempts 
       SET status = $1, submitted_at = NOW(), score = $2 
       WHERE id = $3`,
      [finalStatus, score, attemptId]
    );

    // Update assignment
    if (attempt.assignment_id) {
      await client.query(
        `UPDATE assessment_assignments SET status = 'COMPLETED' WHERE id = $1`,
        [attempt.assignment_id]
      );
    }

    // Insert or update Result
    const resultInsertRes = await client.query(
      `INSERT INTO results (
         attempt_id, student_id, assessment_id, score, total_marks, percentage, 
         correct_answers, wrong_answers, unanswered
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (attempt_id) DO UPDATE SET
         score = EXCLUDED.score,
         total_marks = EXCLUDED.total_marks,
         percentage = EXCLUDED.percentage,
         correct_answers = EXCLUDED.correct_answers,
         wrong_answers = EXCLUDED.wrong_answers,
         unanswered = EXCLUDED.unanswered,
         completed_at = NOW()
       RETURNING *`,
      [
        attemptId, studentId, attempt.assessment_id, score, attempt.total_marks, 
        percentage, correctAnswers, wrongAnswers, unanswered
      ]
    );

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [
        studentUserId,
        finalStatus === 'AUTO_SUBMITTED' ? 'ATTEMPT_AUTO_SUBMITTED' : 'ATTEMPT_SUBMITTED',
        'attempt',
        attemptId,
        JSON.stringify({
          studentName: student.full_name,
          registerNumber: student.register_number,
          score,
          percentage,
          autoSubmitted: finalStatus === 'AUTO_SUBMITTED'
        })
      ]
    );

    await client.query('COMMIT');

    // Notify connected Live Monitoring dashboards
    emitToAdmin('student_submitted', {
      attemptId,
      studentId,
      studentName: student.full_name,
      score,
      percentage,
      status: finalStatus,
      timestamp: new Date()
    });

    emitToAdmin('result_generated', {
      attemptId,
      result: resultInsertRes.rows[0],
      timestamp: new Date()
    });

    return { 
      id: attemptId, 
      status: finalStatus, 
      score,
      result: resultInsertRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getAttempt(attemptId, studentUserId) {
  const statusInfo = await checkAndHandleExpiration(attemptId, studentUserId);
  if (statusInfo.isExpired) {
    throw new Error('ATTEMPT_EXPIRED');
  }

  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const attemptRes = await pool.query(
    `SELECT a.*, ass.title as assessment_title, ass.duration_minutes 
     FROM attempts a 
     JOIN assessments ass ON a.assessment_id = ass.id 
     WHERE a.id = $1`,
    [attemptId]
  );
  if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
  const attempt = attemptRes.rows[0];
  if (attempt.student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');

  const questions = await getAttemptQuestions(attemptId, studentUserId);

  return {
    attempt: {
      ...attempt,
      remaining_seconds: statusInfo.remainingSeconds,
      expires_at: statusInfo.expiresAt
    },
    questions
  };
}

async function getAttemptStatus(attemptId, studentUserId) {
  return await checkAndHandleExpiration(attemptId, studentUserId);
}

module.exports = {
  startAttempt,
  getAttempt,
  getAttemptQuestions,
  getAttemptStatus,
  saveAnswer,
  submitAttempt,
  checkAndHandleExpiration
};

