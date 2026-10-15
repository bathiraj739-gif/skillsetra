const pool = require('../config/db');
const { emitToAdmin } = require('../socket');
const emailService = require('./emailService');

// In-memory cache for static question content (immutable per question_id)
// TTL: 5 minutes. Does not cache answers, attempt state, or student data.
const questionContentCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedQuestion(id) {
  const item = questionContentCache.get(id);
  if (item && Date.now() - item.cachedAt < CACHE_TTL_MS) {
    return item.data;
  }
  return null;
}

function setCachedQuestion(id, data) {
  questionContentCache.set(id, {
    data,
    cachedAt: Date.now()
  });
  // Bound map size to 5000 items
  if (questionContentCache.size > 5000) {
    const firstKey = questionContentCache.keys().next().value;
    questionContentCache.delete(firstKey);
  }
}

// Helper to shuffle array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function checkAndHandleExpiration(attemptId, studentUserId) {
  const res = await pool.query(
    `SELECT 
       a.id, a.student_id, a.status, a.started_at, a.submitted_at, 
       s.id as student_record_id, ass.duration_minutes
     FROM attempts a
     JOIN students s ON s.user_id = $2
     JOIN assessments ass ON a.assessment_id = ass.id
     WHERE a.id = $1`,
    [attemptId, studentUserId]
  );

  if (res.rows.length === 0) {
    const checkStudent = await pool.query(`SELECT 1 FROM students WHERE user_id = $1`, [studentUserId]);
    if (checkStudent.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const attempt = res.rows[0];
  if (attempt.student_id !== attempt.student_record_id) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

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

    // Resolve student
    const studentRes = await client.query(
      `SELECT id, full_name, register_number FROM students WHERE user_id = $1`,
      [studentUserId]
    );
    if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    const student = studentRes.rows[0];
    const studentId = student.id;

    // Validate assignment
    let assignmentRes = await client.query(
      `SELECT a.id, a.assessment_id, a.status, a.due_at, ass.total_marks, ass.title, ass.duration_minutes,
              COALESCE(ass.assessment_mode, 'STANDARD') as assessment_mode,
              COALESCE(ass.starting_difficulty, 'MEDIUM') as starting_difficulty,
              COALESCE(ass.min_questions, 20) as min_questions,
              COALESCE(ass.max_questions, 30) as max_questions
       FROM assessment_assignments a
       JOIN assessments ass ON a.assessment_id = ass.id
       WHERE (a.id = $1 OR a.assessment_id = $1) AND a.student_id = $2`,
      [assignmentOrAssessmentId, studentId]
    );

    if (assignmentRes.rows.length === 0) {
      const checkAny = await client.query(
        `SELECT 1 FROM assessment_assignments WHERE id = $1 OR assessment_id = $1`,
        [assignmentOrAssessmentId]
      );
      if (checkAny.rows.length > 0) {
        throw new Error('UNAUTHORIZED_ACCESS');
      }
      throw new Error('ASSIGNMENT_NOT_FOUND');
    }

    const assignment = assignmentRes.rows[0];
    const assignmentId = assignment.id;
    const isAdaptive = assignment.assessment_mode === 'ADAPTIVE';

    if (assignment.status === 'EXPIRED' || (assignment.due_at && new Date(assignment.due_at) < new Date())) {
      throw new Error('ASSIGNMENT_EXPIRED');
    }
    if (assignment.status === 'COMPLETED') {
      throw new Error('ASSIGNMENT_COMPLETED');
    }

    // Check if attempt already exists (Idempotent recovery)
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
            total_marks: assignment.total_marks,
            assessment_mode: assignment.assessment_mode,
            starting_difficulty: assignment.starting_difficulty,
            min_questions: assignment.min_questions,
            max_questions: assignment.max_questions
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
            total_marks: assignment.total_marks,
            assessment_mode: assignment.assessment_mode,
            starting_difficulty: assignment.starting_difficulty,
            min_questions: assignment.min_questions,
            max_questions: assignment.max_questions
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

    if (isAdaptive) {
      // ADAPTIVE MODE: Select 1 starting question with starting_difficulty
      const startDiff = assignment.starting_difficulty || 'MEDIUM';

      // 1. Try from linked questions if any
      let startQRes = await client.query(
        `SELECT q.id FROM assessment_questions aq 
         JOIN questions q ON aq.question_id = q.id 
         WHERE aq.assessment_id = $1 AND q.is_active = true AND q.difficulty = $2 AND q.category IN ('APTITUDE', 'VERBAL')
         ORDER BY RANDOM() LIMIT 1`,
        [assignment.assessment_id, startDiff]
      );

      // 2. If none in linked pool with startDiff, try any linked active question
      if (startQRes.rows.length === 0) {
        startQRes = await client.query(
          `SELECT q.id FROM assessment_questions aq 
           JOIN questions q ON aq.question_id = q.id 
           WHERE aq.assessment_id = $1 AND q.is_active = true AND q.category IN ('APTITUDE', 'VERBAL')
           ORDER BY RANDOM() LIMIT 1`,
          [assignment.assessment_id]
        );
      }

      // 3. If still none (or assessment has no linked questions), query master question bank
      if (startQRes.rows.length === 0) {
        startQRes = await client.query(
          `SELECT id FROM questions 
           WHERE is_active = true AND difficulty = $1 AND category IN ('APTITUDE', 'VERBAL')
           ORDER BY RANDOM() LIMIT 1`,
          [startDiff]
        );
      }

      // 4. Fallback to any active question in master question bank
      if (startQRes.rows.length === 0) {
        startQRes = await client.query(
          `SELECT id FROM questions 
           WHERE is_active = true AND category IN ('APTITUDE', 'VERBAL')
           ORDER BY RANDOM() LIMIT 1`
        );
      }

      if (startQRes.rows.length === 0) {
        throw new Error('NO_QUESTIONS_AVAILABLE');
      }

      const startingQuestionId = startQRes.rows[0].id;

      // Insert as question_order 1
      await client.query(
        `INSERT INTO attempt_questions (attempt_id, question_id, question_order) VALUES ($1, $2, 1)`,
        [attempt.id, startingQuestionId]
      );
    } else {
      // STANDARD MODE: Fetch all assessment questions and shuffle
      const qRes = await client.query(
        `SELECT question_id FROM assessment_questions WHERE assessment_id = $1 ORDER BY question_order ASC`,
        [assignment.assessment_id]
      );
      const questions = qRes.rows.map(r => r.question_id);

      // Randomize question order for this student attempt
      shuffleArray(questions);

      // Bulk insert into attempt_questions to establish fixed attempt order
      if (questions.length > 0) {
        const values = [];
        const placeholders = questions.map((qid, idx) => {
          const offset = idx * 3;
          values.push(attempt.id, qid, idx + 1);
          return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
        }).join(', ');

        await client.query(
          `INSERT INTO attempt_questions (attempt_id, question_id, question_order) VALUES ${placeholders}`,
          values
        );
      }
    }

    // Non-blocking activity log
    client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [
        studentUserId,
        'ATTEMPT_STARTED',
        'attempt',
        attempt.id,
        JSON.stringify({
          studentName: student.full_name,
          registerNumber: student.register_number,
          assessmentTitle: assignment.title,
          assessmentMode: assignment.assessment_mode
        })
      ]
    ).catch(e => console.warn('Activity log write skipped:', e.message));

    await client.query('COMMIT');

    const durationMinutes = parseInt(assignment.duration_minutes || 30, 10);
    const startedAtMs = new Date(attempt.started_at).getTime();
    const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);

    // Notify connected Live Monitoring dashboards asynchronously
    try {
      emitToAdmin('student_started', {
        attemptId: attempt.id,
        studentId: studentId,
        studentName: student.full_name,
        registerNumber: student.register_number,
        assessmentId: assignment.assessment_id,
        assessmentTitle: assignment.title,
        assessmentMode: assignment.assessment_mode,
        timestamp: new Date()
      });
    } catch (e) {
      // Non-fatal
    }

    return {
      ...attempt,
      remaining_seconds: durationMinutes * 60,
      expires_at: new Date(expiresAtMs).toISOString(),
      assessment: {
        id: assignment.assessment_id,
        title: assignment.title,
        duration_minutes: assignment.duration_minutes,
        total_marks: assignment.total_marks,
        assessment_mode: assignment.assessment_mode,
        starting_difficulty: assignment.starting_difficulty,
        min_questions: assignment.min_questions,
        max_questions: assignment.max_questions
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
  // Validate ownership and status in one joined query
  const res = await pool.query(
    `SELECT 
       a.id, a.student_id, a.status, a.started_at, a.submitted_at, 
       s.id as student_record_id, ass.duration_minutes
     FROM attempts a
     JOIN students s ON s.user_id = $2
     JOIN assessments ass ON a.assessment_id = ass.id
     WHERE a.id = $1`,
    [attemptId, studentUserId]
  );

  if (res.rows.length === 0) {
    const checkStudent = await pool.query(`SELECT 1 FROM students WHERE user_id = $1`, [studentUserId]);
    if (checkStudent.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const attempt = res.rows[0];
  if (attempt.student_id !== attempt.student_record_id) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

  const durationMinutes = parseInt(attempt.duration_minutes || 30, 10);
  const startedAtMs = new Date(attempt.started_at).getTime();
  const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);
  const nowMs = Date.now();

  if (nowMs >= expiresAtMs && (attempt.status === 'IN_PROGRESS' || attempt.status === 'NOT_STARTED')) {
    await submitAttempt(attemptId, studentUserId, 'AUTO_SUBMITTED');
    throw new Error('ATTEMPT_EXPIRED');
  }

  if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'NOT_STARTED') {
    throw new Error('ATTEMPT_EXPIRED');
  }

  // Fetch attempt questions with student's current answers
  // Security: Never returns correct_option during active exam!
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
  // Single fast query to validate attempt, ownership, question membership and expiry
  const validRes = await pool.query(
    `SELECT 
       a.id as attempt_id,
       a.status as attempt_status,
       a.started_at,
       ass.duration_minutes,
       q.correct_option,
       q.marks
     FROM attempts a
     JOIN students s ON a.student_id = s.id AND s.user_id = $3
     JOIN assessments ass ON a.assessment_id = ass.id
     JOIN attempt_questions aq ON aq.attempt_id = a.id AND aq.question_id = $2
     JOIN questions q ON q.id = $2
     WHERE a.id = $1`,
    [attemptId, questionId, studentUserId]
  );

  if (validRes.rows.length === 0) {
    const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
    if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');

    const attemptRes = await pool.query(`SELECT student_id, status FROM attempts WHERE id = $1`, [attemptId]);
    if (attemptRes.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
    if (attemptRes.rows[0].student_id !== studentRes.rows[0].id) throw new Error('UNAUTHORIZED_ACCESS');

    const aqRes = await pool.query(`SELECT 1 FROM attempt_questions WHERE attempt_id = $1 AND question_id = $2`, [attemptId, questionId]);
    if (aqRes.rows.length === 0) throw new Error('QUESTION_NOT_IN_ATTEMPT');

    throw new Error('ATTEMPT_NOT_IN_PROGRESS');
  }

  const row = validRes.rows[0];

  // Expiry check
  const durationMinutes = parseInt(row.duration_minutes || 30, 10);
  const startedAtMs = new Date(row.started_at).getTime();
  const expiresAtMs = startedAtMs + (durationMinutes * 60 * 1000);

  if (Date.now() >= expiresAtMs || row.attempt_status !== 'IN_PROGRESS') {
    if (Date.now() >= expiresAtMs && row.attempt_status === 'IN_PROGRESS') {
      await submitAttempt(attemptId, studentUserId, 'AUTO_SUBMITTED');
    }
    throw new Error('ATTEMPT_EXPIRED');
  }

  // Calculate correctness and marks
  const normalizedOption = selectedOption ? String(selectedOption).trim() : null;
  const isCorrect = normalizedOption ? (normalizedOption === row.correct_option?.trim()) : null;
  const marksAwarded = isCorrect ? (row.marks || 1) : 0;

  // Optimized single-query UPSERT with DISTINCT check
  // Skips write IO if the student resubmitted the exact same answer
  await pool.query(
    `INSERT INTO answers (attempt_id, question_id, selected_option, is_correct, marks_awarded, answered_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (attempt_id, question_id) 
     DO UPDATE SET 
       selected_option = EXCLUDED.selected_option,
       is_correct = EXCLUDED.is_correct,
       marks_awarded = EXCLUDED.marks_awarded,
       updated_at = NOW()
     WHERE answers.selected_option IS DISTINCT FROM EXCLUDED.selected_option`,
    [attemptId, questionId, normalizedOption, isCorrect, marksAwarded]
  );

  // Emit async telemetry (non-blocking)
  try {
    emitToAdmin('answer_saved', {
      attemptId,
      questionId,
      selectedOption: normalizedOption,
      timestamp: new Date()
    });
  } catch (e) {
    // Non-fatal
  }

  return true;
}

async function submitAttempt(attemptId, studentUserId, targetStatus = 'SUBMITTED') {
  const finalStatus = targetStatus === 'AUTO_SUBMITTED' ? 'AUTO_SUBMITTED' : 'SUBMITTED';

  // 1. Resolve student and verify ownership
  const studentRes = await pool.query(
    `SELECT s.id, s.full_name, s.register_number, s.email 
     FROM students s 
     WHERE s.user_id = $1`,
    [studentUserId]
  );
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const student = studentRes.rows[0];
  const studentId = student.id;

  // 2. Atomic state transition: Only 1 concurrent caller can successfully update from IN_PROGRESS/NOT_STARTED
  const updateRes = await pool.query(
    `UPDATE attempts 
     SET status = $1, submitted_at = NOW() 
     WHERE id = $2 AND student_id = $3 AND status IN ('IN_PROGRESS', 'NOT_STARTED')
     RETURNING id, assessment_id, assignment_id, total_marks`,
    [finalStatus, attemptId, studentId]
  );

  // If 0 rows were updated, check if it was already submitted or unauthorized
  if (updateRes.rows.length === 0) {
    const checkAttempt = await pool.query(
      `SELECT a.id, a.student_id, a.status, a.score, r.id as result_id
       FROM attempts a
       LEFT JOIN results r ON r.attempt_id = a.id
       WHERE a.id = $1`,
      [attemptId]
    );

    if (checkAttempt.rows.length === 0) throw new Error('ATTEMPT_NOT_FOUND');
    const existing = checkAttempt.rows[0];
    if (existing.student_id !== studentId) throw new Error('UNAUTHORIZED_ACCESS');

    // IDEMPOTENCY: Already submitted - fetch existing result and return safely
    if (existing.status === 'SUBMITTED' || existing.status === 'AUTO_SUBMITTED') {
      const existingResultRes = await pool.query(`SELECT * FROM results WHERE attempt_id = $1`, [attemptId]);
      return {
        id: attemptId,
        status: existing.status,
        score: existing.score,
        result: existingResultRes.rows[0] || null
      };
    }
  }

  const attempt = updateRes.rows[0];

  // 3. Single set-based aggregate query to compute score, correct, wrong, unanswered
  const statsRes = await pool.query(
    `SELECT 
       COUNT(aq.question_id) as total_qs,
       COUNT(CASE WHEN ans.is_correct = true THEN 1 END) as correct_answers,
       COUNT(CASE WHEN ans.is_correct = false THEN 1 END) as wrong_answers,
       COALESCE(SUM(ans.marks_awarded), 0) as score
     FROM attempt_questions aq
     LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
     WHERE aq.attempt_id = $1`,
    [attemptId]
  );

  const stats = statsRes.rows[0];
  const totalQs = parseInt(stats.total_qs || 0, 10);
  const correctAnswers = parseInt(stats.correct_answers || 0, 10);
  const wrongAnswers = parseInt(stats.wrong_answers || 0, 10);
  const score = parseFloat(stats.score || 0);
  const unanswered = Math.max(0, totalQs - (correctAnswers + wrongAnswers));
  const totalMarks = parseFloat(attempt.total_marks || totalQs || 1);
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  // 4. Update attempt score and mark assignment COMPLETED
  await pool.query(
    `UPDATE attempts SET score = $1 WHERE id = $2`,
    [score, attemptId]
  );

  if (attempt.assignment_id) {
    await pool.query(
      `UPDATE assessment_assignments SET status = 'COMPLETED' WHERE id = $1`,
      [attempt.assignment_id]
    );
  }

  // 5. Insert or update result idempotently
  const resultRes = await pool.query(
    `INSERT INTO results (
       attempt_id, student_id, assessment_id, score, total_marks, percentage, 
       correct_answers, wrong_answers, unanswered, completed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
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
      attemptId, studentId, attempt.assessment_id, score, totalMarks, 
      percentage, correctAnswers, wrongAnswers, unanswered
    ]
  );

  // 6. Send Assessment Completed Notification Email asynchronously post-evaluation
  if (student.email) {
    (async () => {
      try {
        const assInfo = await pool.query(`SELECT title FROM assessments WHERE id = $1`, [attempt.assessment_id]);
        const assessmentTitle = assInfo.rows[0]?.title || 'Assessment';

        await emailService.sendAssessmentCompletedEmail({
          to: student.email,
          studentName: student.full_name,
          assessmentTitle,
          score,
          totalMarks,
          percentage: percentage.toFixed(2),
          correctAnswers,
          wrongAnswers,
          unanswered,
          completedAt: new Date().toLocaleString()
        });
      } catch (emailErr) {
        console.error('[ASSESSMENT COMPLETED EMAIL ERROR]', emailErr.message || emailErr);
      }
    })();
  }

  // 7. Non-blocking activity log
  pool.query(
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
  ).catch(e => console.warn('Activity log write skipped:', e.message));

  // 8. Notify connected Live Monitoring dashboards asynchronously
  try {
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
      result: resultRes.rows[0],
      timestamp: new Date()
    });
  } catch (e) {
    // Non-fatal
  }

  return { 
    id: attemptId, 
    status: finalStatus, 
    score,
    total_marks: totalMarks,
    totalMarks,
    total_questions: totalQs,
    totalQuestions: totalQs,
    percentage,
    correct_answers: correctAnswers,
    wrong_answers: wrongAnswers,
    unanswered,
    result: resultRes.rows[0]
  };
}

async function getNextAdaptiveQuestion(attemptId, studentUserId) {
  const statusInfo = await checkAndHandleExpiration(attemptId, studentUserId);
  if (statusInfo.isExpired) {
    throw new Error('ATTEMPT_EXPIRED');
  }

  const client = await pool.connect();
  try {
    // 1. Verify attempt ownership, status and adaptive mode
    const attRes = await client.query(`
      SELECT 
        a.id, a.assessment_id, a.student_id, a.status,
        ass.title,
        COALESCE(ass.assessment_mode, 'STANDARD') as assessment_mode,
        COALESCE(ass.starting_difficulty, 'MEDIUM') as starting_difficulty,
        COALESCE(ass.min_questions, 20) as min_questions,
        COALESCE(ass.max_questions, 30) as max_questions
      FROM attempts a
      JOIN students s ON a.student_id = s.id AND s.user_id = $2
      JOIN assessments ass ON a.assessment_id = ass.id
      WHERE a.id = $1
    `, [attemptId, studentUserId]);

    if (attRes.rows.length === 0) {
      const checkStudent = await client.query(`SELECT 1 FROM students WHERE user_id = $1`, [studentUserId]);
      if (checkStudent.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
      throw new Error('ATTEMPT_NOT_FOUND');
    }

    const attempt = attRes.rows[0];
    if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'NOT_STARTED') {
      throw new Error('ATTEMPT_NOT_IN_PROGRESS');
    }

    if (attempt.assessment_mode !== 'ADAPTIVE') {
      throw new Error('NOT_ADAPTIVE_ASSESSMENT');
    }

    const maxQuestions = parseInt(attempt.max_questions || 30, 10);

    // 2. Query all questions currently assigned to this attempt with student's answers
    const currQsRes = await client.query(`
      SELECT 
        aq.question_order, aq.question_id, q.category, q.difficulty, q.marks,
        ans.selected_option, ans.is_correct
      FROM attempt_questions aq
      JOIN questions q ON aq.question_id = q.id
      LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
      WHERE aq.attempt_id = $1
      ORDER BY aq.question_order ASC
    `, [attemptId]);

    const assigned = currQsRes.rows;
    const currentCount = assigned.length;

    // Check if max question limit reached
    if (currentCount >= maxQuestions) {
      return {
        completed: true,
        max_reached: true,
        total_questions: currentCount,
        message: 'Maximum question limit reached for this adaptive assessment.'
      };
    }

    // 3. Check if the latest question has been answered
    const lastQ = assigned[assigned.length - 1];
    if (lastQ && !lastQ.selected_option) {
      // Idempotency: Student has not answered the current question yet
      const qDataRes = await client.query(`
        SELECT id, question_text, category, difficulty, option_a, option_b, option_c, option_d, marks
        FROM questions WHERE id = $1
      `, [lastQ.question_id]);

      const qRow = qDataRes.rows[0];
      return {
        is_new: false,
        completed: false,
        total_served: currentCount,
        max_questions: maxQuestions,
        question: {
          ...qRow,
          question_order: lastQ.question_order
        }
      };
    }

    // 4. Determine next target difficulty based on performance on last question
    let targetDifficulty = 'MEDIUM';
    if (lastQ) {
      const prevDiff = String(lastQ.difficulty).toUpperCase();
      const wasCorrect = lastQ.is_correct === true;

      if (wasCorrect) {
        if (prevDiff === 'EASY') targetDifficulty = 'MEDIUM';
        else if (prevDiff === 'MEDIUM') targetDifficulty = 'HARD';
        else targetDifficulty = 'HARD';
      } else {
        if (prevDiff === 'HARD') targetDifficulty = 'MEDIUM';
        else if (prevDiff === 'MEDIUM') targetDifficulty = 'EASY';
        else targetDifficulty = 'EASY';
      }
    } else {
      targetDifficulty = attempt.starting_difficulty || 'MEDIUM';
    }

    // 5. Category balancing (Alternate between APTITUDE and VERBAL)
    const aptCount = assigned.filter(r => r.category === 'APTITUDE').length;
    const verbCount = assigned.filter(r => r.category === 'VERBAL').length;
    let targetCategory = aptCount > verbCount ? 'VERBAL' : (verbCount > aptCount ? 'APTITUDE' : (lastQ?.category === 'APTITUDE' ? 'VERBAL' : 'APTITUDE'));

    // 6. Select next question (avoiding already used questions in this attempt)
    const usedQuestionIds = assigned.map(r => r.question_id);

    let nextQRes;

    // Check if assessment has linked questions pool
    const hasLinkedPool = await client.query(`SELECT 1 FROM assessment_questions WHERE assessment_id = $1 LIMIT 1`, [attempt.assessment_id]);

    if (hasLinkedPool.rows.length > 0) {
      // Try linked pool with target difficulty and target category
      nextQRes = await client.query(`
        SELECT q.id, q.question_text, q.category, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.marks
        FROM assessment_questions aq
        JOIN questions q ON aq.question_id = q.id
        WHERE aq.assessment_id = $1 
          AND q.is_active = true 
          AND q.id != ALL($2::uuid[])
          AND q.difficulty = $3 
          AND q.category = $4
        ORDER BY RANDOM() LIMIT 1
      `, [attempt.assessment_id, usedQuestionIds, targetDifficulty, targetCategory]);

      // Fallback: linked pool with target difficulty
      if (nextQRes.rows.length === 0) {
        nextQRes = await client.query(`
          SELECT q.id, q.question_text, q.category, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.marks
          FROM assessment_questions aq
          JOIN questions q ON aq.question_id = q.id
          WHERE aq.assessment_id = $1 
            AND q.is_active = true 
            AND q.id != ALL($2::uuid[])
            AND q.difficulty = $3
          ORDER BY RANDOM() LIMIT 1
        `, [attempt.assessment_id, usedQuestionIds, targetDifficulty]);
      }

      // Fallback: any linked pool question remaining
      if (nextQRes.rows.length === 0) {
        nextQRes = await client.query(`
          SELECT q.id, q.question_text, q.category, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.marks
          FROM assessment_questions aq
          JOIN questions q ON aq.question_id = q.id
          WHERE aq.assessment_id = $1 
            AND q.is_active = true 
            AND q.id != ALL($2::uuid[])
          ORDER BY RANDOM() LIMIT 1
        `, [attempt.assessment_id, usedQuestionIds]);
      }
    }

    // If no linked pool or linked pool exhausted, query master question bank
    if (!nextQRes || nextQRes.rows.length === 0) {
      nextQRes = await client.query(`
        SELECT id, question_text, category, difficulty, option_a, option_b, option_c, option_d, marks
        FROM questions
        WHERE is_active = true 
          AND category IN ('APTITUDE', 'VERBAL')
          AND id != ALL($1::uuid[])
          AND difficulty = $2 
          AND category = $3
        ORDER BY RANDOM() LIMIT 1
      `, [usedQuestionIds, targetDifficulty, targetCategory]);

      // Fallback: master bank with target difficulty
      if (nextQRes.rows.length === 0) {
        nextQRes = await client.query(`
          SELECT id, question_text, category, difficulty, option_a, option_b, option_c, option_d, marks
          FROM questions
          WHERE is_active = true 
            AND category IN ('APTITUDE', 'VERBAL')
            AND id != ALL($1::uuid[])
            AND difficulty = $2
          ORDER BY RANDOM() LIMIT 1
        `, [usedQuestionIds, targetDifficulty]);
      }

      // Fallback: master bank with any active question
      if (nextQRes.rows.length === 0) {
        nextQRes = await client.query(`
          SELECT id, question_text, category, difficulty, option_a, option_b, option_c, option_d, marks
          FROM questions
          WHERE is_active = true 
            AND category IN ('APTITUDE', 'VERBAL')
            AND id != ALL($1::uuid[])
          ORDER BY RANDOM() LIMIT 1
        `, [usedQuestionIds]);
      }
    }

    // If no question available at all
    if (nextQRes.rows.length === 0) {
      return {
        completed: true,
        pool_exhausted: true,
        total_questions: currentCount,
        message: 'No further questions available in the question pool.'
      };
    }

    const nextQ = nextQRes.rows[0];
    const newOrder = currentCount + 1;

    // 7. Store selected question into attempt_questions (Immutable once selected!)
    await client.query(`
      INSERT INTO attempt_questions (attempt_id, question_id, question_order)
      VALUES ($1, $2, $3)
    `, [attemptId, nextQ.id, newOrder]);

    return {
      is_new: true,
      completed: false,
      total_served: newOrder,
      max_questions: maxQuestions,
      question: {
        ...nextQ,
        question_order: newOrder
      }
    };
  } finally {
    client.release();
  }
}

async function getAttempt(attemptId, studentUserId) {
  const statusInfo = await checkAndHandleExpiration(attemptId, studentUserId);
  if (statusInfo.isExpired) {
    throw new Error('ATTEMPT_EXPIRED');
  }

  const res = await pool.query(
    `SELECT 
       a.id, a.assessment_id, a.student_id, a.assignment_id, a.status, a.started_at, a.submitted_at, a.score, a.total_marks,
       s.id as student_record_id,
       ass.title as assessment_title, ass.duration_minutes,
       COALESCE(ass.assessment_mode, 'STANDARD') as assessment_mode,
       COALESCE(ass.starting_difficulty, 'MEDIUM') as starting_difficulty,
       COALESCE(ass.min_questions, 20) as min_questions,
       COALESCE(ass.max_questions, 30) as max_questions
     FROM attempts a 
     JOIN students s ON s.user_id = $2
     JOIN assessments ass ON a.assessment_id = ass.id 
     WHERE a.id = $1`,
    [attemptId, studentUserId]
  );

  if (res.rows.length === 0) {
    const checkStudent = await pool.query(`SELECT 1 FROM students WHERE user_id = $1`, [studentUserId]);
    if (checkStudent.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
    throw new Error('ATTEMPT_NOT_FOUND');
  }

  const attempt = res.rows[0];
  if (attempt.student_id !== attempt.student_record_id) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

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
  getNextAdaptiveQuestion,
  saveAnswer,
  submitAttempt,
  checkAndHandleExpiration
};

