const pool = require('../config/db');
const attemptService = require('./attemptService'); // We will use this to auto-submit expired attempts

async function _expireOldAssignments(client) {
  await client.query(
    `UPDATE assessment_assignments 
     SET status = 'EXPIRED' 
     WHERE status = 'ASSIGNED' AND due_at IS NOT NULL AND due_at < NOW()`
  );
}

async function getDashboardOverview(assessmentId = null) {
  const client = await pool.connect();
  try {
    await _expireOldAssignments(client);

    if (assessmentId) {
      // Assessment specific overview
      const assRes = await client.query(
        `SELECT id, title, status, duration_minutes, total_marks FROM assessments WHERE id = $1`,
        [assessmentId]
      );
      if (assRes.rows.length === 0) throw new Error('ASSESSMENT_NOT_FOUND');
      const assessment = assRes.rows[0];

      const statsRes = await client.query(`
        SELECT 
          COUNT(*) as total_assigned,
          COUNT(*) FILTER (WHERE status = 'ASSIGNED') as not_started,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired,
          (SELECT COUNT(*) FROM attempts WHERE assessment_id = $1 AND status = 'AUTO_SUBMITTED') as auto_submitted
        FROM assessment_assignments 
        WHERE assessment_id = $1
      `, [assessmentId]);

      const s = statsRes.rows[0];

      return {
        assessment: {
          id: assessment.id,
          title: assessment.title,
          status: assessment.status,
          durationMinutes: assessment.duration_minutes,
          totalMarks: assessment.total_marks
        },
        statistics: {
          totalAssigned: parseInt(s.total_assigned, 10),
          notStarted: parseInt(s.not_started, 10),
          inProgress: parseInt(s.in_progress, 10),
          completed: parseInt(s.completed, 10),
          autoSubmitted: parseInt(s.auto_submitted, 10),
          expired: parseInt(s.expired, 10)
        }
      };
    } else {
      // Overall stats
      const assStats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
          COUNT(*) FILTER (WHERE status = 'CLOSED') as closed
        FROM assessments
      `);

      const stuStats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE u.is_active = true) as active
        FROM students s
        JOIN users u ON s.user_id = u.id
      `);

      const asgnStats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired
        FROM assessment_assignments
      `);

      const autoSub = await client.query(`SELECT COUNT(*) as count FROM attempts WHERE status = 'AUTO_SUBMITTED'`);

      const resStats = await client.query(`
        SELECT 
          COUNT(*) as completed,
          COALESCE(AVG(percentage), 0) as average_percentage
        FROM results
      `);

      return {
        assessments: {
          total: parseInt(assStats.rows[0].total, 10),
          draft: parseInt(assStats.rows[0].draft, 10),
          published: parseInt(assStats.rows[0].published, 10),
          closed: parseInt(assStats.rows[0].closed, 10)
        },
        students: {
          total: parseInt(stuStats.rows[0].total, 10),
          active: parseInt(stuStats.rows[0].active, 10)
        },
        assignments: {
          total: parseInt(asgnStats.rows[0].total, 10),
          assigned: parseInt(asgnStats.rows[0].assigned, 10),
          inProgress: parseInt(asgnStats.rows[0].in_progress, 10),
          completed: parseInt(asgnStats.rows[0].completed, 10),
          autoSubmitted: parseInt(autoSub.rows[0].count, 10),
          expired: parseInt(asgnStats.rows[0].expired, 10)
        },
        results: {
          completed: parseInt(resStats.rows[0].completed, 10),
          averagePercentage: parseFloat(parseFloat(resStats.rows[0].average_percentage).toFixed(2))
        }
      };
    }
  } finally {
    client.release();
  }
}

async function getRecentActivity(assessmentId = null, limit = 50) {
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
  let queryParams = [parsedLimit];
  let joinAssessment = '';
  let whereClause = '';

  if (assessmentId) {
    joinAssessment = `
      LEFT JOIN attempts att ON l.entity_id = att.id AND l.entity_type = 'attempt'
      LEFT JOIN assessment_assignments asg ON l.entity_id = asg.id AND l.entity_type = 'assessment_assignment'
    `;
    whereClause = `WHERE att.assessment_id = $2 OR asg.assessment_id = $2`;
    queryParams.push(assessmentId);
  }

  const query = `
    SELECT 
      l.id,
      l.action, 
      l.created_at,
      l.metadata,
      u.username,
      s.full_name as student_name,
      s.register_number,
      s.department,
      a.title as assessment_title
    FROM activity_logs l
    JOIN users u ON l.user_id = u.id
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN attempts att_log ON l.entity_id = att_log.id AND l.entity_type = 'attempt'
    LEFT JOIN assessment_assignments asg_log ON l.entity_id = asg_log.id AND l.entity_type = 'assessment_assignment'
    LEFT JOIN assessments a ON a.id = COALESCE(att_log.assessment_id, asg_log.assessment_id)
    ${joinAssessment}
    ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT $1
  `;

  const res = await pool.query(query, queryParams);
  return res.rows.map(r => {
    const meta = r.metadata || {};
    const studentName = r.student_name || meta.studentName || r.username;
    const assessmentTitle = r.assessment_title || meta.assessmentTitle || 'Assessment';
    let actionLabel = r.action ? r.action.replace(/_/g, ' ') : 'Activity';
    let desc = `${studentName} - ${actionLabel} (${assessmentTitle})`;

    if (r.action === 'ATTEMPT_STARTED') {
      desc = `${studentName} started exam for ${assessmentTitle}`;
    } else if (r.action === 'ATTEMPT_SUBMITTED') {
      desc = `${studentName} submitted ${assessmentTitle} ${meta.score != null ? `(Score: ${meta.score})` : ''}`;
    } else if (r.action === 'ASSIGNMENT_CREATED') {
      desc = `Assigned ${assessmentTitle} to candidate`;
    }

    return {
      id: r.id,
      action: r.action,
      studentName,
      username: r.username,
      registerNumber: r.register_number || meta.registerNumber,
      department: r.department,
      assessmentTitle,
      description: desc,
      createdAt: r.created_at,
      created_at: r.created_at
    };
  });
}

async function getLiveMonitoringFeed() {
  await autoSubmitExpiredAttempts();

  const activeQuery = `
    SELECT 
      att.id as "attemptId",
      att.started_at as "startedAt",
      att.status,
      s.id as "studentId",
      s.full_name as "studentName",
      s.register_number as "registerNumber",
      s.department,
      a.id as "assessmentId",
      a.title as "assessmentTitle",
      a.duration_minutes as "durationMinutes",
      a.total_marks as "totalMarks",
      (SELECT COUNT(*) FROM attempt_questions aq WHERE aq.attempt_id = att.id) as "totalQuestions",
      (SELECT COUNT(*) FROM answers ans WHERE ans.attempt_id = att.id AND ans.selected_option IS NOT NULL) as "answeredQuestions"
    FROM attempts att
    JOIN students s ON att.student_id = s.id
    JOIN assessments a ON att.assessment_id = a.id
    WHERE att.status = 'IN_PROGRESS'
    ORDER BY att.started_at DESC
  `;
  const activeRes = await pool.query(activeQuery);
  const activeSessions = activeRes.rows.map(r => {
    const totalQ = parseInt(r.totalQuestions || 0, 10);
    const answeredQ = parseInt(r.answeredQuestions || 0, 10);
    const progressPercentage = totalQ > 0 ? parseFloat(((answeredQ / totalQ) * 100).toFixed(1)) : 0;
    const expiresAt = new Date(new Date(r.startedAt).getTime() + (r.durationMinutes || 30) * 60000);

    return {
      id: r.attemptId,
      attemptId: r.attemptId,
      studentId: r.studentId,
      studentName: r.studentName,
      registerNumber: r.registerNumber,
      department: r.department,
      assessmentId: r.assessmentId,
      assessmentTitle: r.assessmentTitle,
      durationMinutes: r.durationMinutes,
      startedAt: r.startedAt,
      expiresAt,
      totalQuestions: totalQ,
      answeredQuestions: answeredQ,
      unansweredQuestions: totalQ - answeredQ,
      progressPercentage,
      status: 'IN_PROGRESS'
    };
  });

  const activities = await getRecentActivity(null, 50);

  const summaryRes = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as active_count,
      COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'AUTO_SUBMITTED') AND submitted_at::date = CURRENT_DATE) as completed_today_count,
      COUNT(*) as total_attempts
    FROM attempts
  `);
  const sumRow = summaryRes.rows[0];

  return {
    activeSessions,
    activities,
    summary: {
      activeSessionsCount: parseInt(sumRow.active_count || 0, 10),
      completedTodayCount: parseInt(sumRow.completed_today_count || 0, 10),
      totalAttemptsCount: parseInt(sumRow.total_attempts || 0, 10)
    }
  };
}

async function getAssessmentSummaries(filters) {
  const { page = 1, limit = 20, search } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [parsedLimit, offset];
  let whereClause = '';

  if (search) {
    whereClause = `WHERE a.title ILIKE $3`;
    queryParams.push(`%${search}%`);
  }

  const query = `
    SELECT 
      a.id as "assessmentId", a.title, a.status,
      COUNT(asg.id) as total_assigned,
      COUNT(asg.id) FILTER (WHERE asg.status = 'ASSIGNED') as not_started,
      COUNT(asg.id) FILTER (WHERE asg.status = 'IN_PROGRESS') as in_progress,
      COUNT(asg.id) FILTER (WHERE asg.status = 'COMPLETED') as completed,
      COUNT(asg.id) FILTER (WHERE asg.status = 'EXPIRED') as expired
    FROM assessments a
    LEFT JOIN assessment_assignments asg ON a.id = asg.assessment_id
    ${whereClause}
    GROUP BY a.id, a.title, a.status
    ORDER BY a.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const res = await pool.query(query, queryParams);
  return res.rows.map(r => ({
    assessmentId: r.assessmentId,
    title: r.title,
    status: r.status,
    totalAssigned: parseInt(r.total_assigned, 10),
    notStarted: parseInt(r.not_started, 10),
    inProgress: parseInt(r.in_progress, 10),
    completed: parseInt(r.completed, 10),
    expired: parseInt(r.expired, 10)
  }));
}

async function autoSubmitExpiredAttempts() {
  // Find all in-progress attempts that have expired
  const query = `
    SELECT att.id, u.id as student_user_id
    FROM attempts att
    JOIN students s ON att.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN assessments a ON att.assessment_id = a.id
    WHERE att.status = 'IN_PROGRESS'
    AND att.started_at + (a.duration_minutes || ' minutes')::interval < NOW()
  `;
  const res = await pool.query(query);
  
  for (const row of res.rows) {
    try {
      await attemptService.submitAttempt(row.id, row.student_user_id);
      // Update status to AUTO_SUBMITTED to distinguish from normal SUBMITTED
      await pool.query(`UPDATE attempts SET status = 'AUTO_SUBMITTED' WHERE id = $1`, [row.id]);
    } catch (e) {
      console.error(`Failed to auto-submit attempt ${row.id}`, e);
    }
  }
}

async function getAssessmentMonitoring(assessmentId, filters) {
  const { page = 1, limit = 50, status = 'ALL', search } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  // First auto-submit expired before generating monitoring data
  await autoSubmitExpiredAttempts();
  await _expireOldAssignments(pool);

  const assRes = await pool.query(`SELECT id, title, duration_minutes FROM assessments WHERE id = $1`, [assessmentId]);
  if (assRes.rows.length === 0) throw new Error('ASSESSMENT_NOT_FOUND');
  const assessment = assRes.rows[0];

  let whereClauses = [`asg.assessment_id = $1`];
  let queryParams = [assessmentId];
  let paramIndex = 2;

  if (search) {
    whereClauses.push(`(s.full_name ILIKE $${paramIndex} OR s.register_number ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  // Build CTE to evaluate priority status logic per student assignment
  // Priority: AUTO_SUBMITTED > COMPLETED (SUBMITTED) > IN_PROGRESS > EXPIRED > ASSIGNED
  const statusLogic = `
    CASE 
      WHEN att.status = 'AUTO_SUBMITTED' THEN 'AUTO_SUBMITTED'
      WHEN att.status = 'SUBMITTED' THEN 'COMPLETED'
      WHEN att.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
      WHEN asg.status = 'EXPIRED' THEN 'EXPIRED'
      ELSE 'ASSIGNED'
    END
  `;

  if (status !== 'ALL') {
    if (!['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'AUTO_SUBMITTED', 'EXPIRED'].includes(status)) {
      throw new Error('INVALID_STATUS');
    }
    whereClauses.push(`(${statusLogic}) = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  const whereString = `WHERE ` + whereClauses.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) FROM assessment_assignments asg
    JOIN students s ON asg.student_id = s.id
    LEFT JOIN attempts att ON asg.id = att.assignment_id
    ${whereString}
  `;
  const countRes = await pool.query(countQuery, queryParams);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    SELECT 
      asg.id as "assignmentId",
      s.id as "studentId", s.register_number as "registerNumber", s.full_name as "fullName", 
      s.email, s.department, s.year, s.section,
      asg.assigned_at as "assignedAt", asg.due_at as "dueAt",
      att.id as "attemptId", att.started_at as "startedAt", att.submitted_at as "submittedAt", att.score,
      (${statusLogic}) as "computed_status",
      r.percentage,
      (SELECT COUNT(*) FROM attempt_questions aq WHERE aq.attempt_id = att.id) as "totalQuestions",
      (SELECT COUNT(*) FROM answers ans WHERE ans.attempt_id = att.id AND ans.selected_option IS NOT NULL) as "answeredQuestions"
    FROM assessment_assignments asg
    JOIN students s ON asg.student_id = s.id
    LEFT JOIN attempts att ON asg.id = att.assignment_id
    LEFT JOIN results r ON att.id = r.attempt_id
    ${whereString}
    ORDER BY s.register_number ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...queryParams, parsedLimit, offset]);

  const students = dataRes.rows.map(r => {
    let progressPercentage = 0;
    const totalQ = parseInt(r.totalQuestions || 0, 10);
    const answeredQ = parseInt(r.answeredQuestions || 0, 10);
    if (totalQ > 0) {
      progressPercentage = parseFloat(((answeredQ / totalQ) * 100).toFixed(2));
    }

    const resObj = {
      assignmentId: r.assignmentId,
      studentId: r.studentId,
      registerNumber: r.registerNumber,
      fullName: r.fullName,
      email: r.email,
      department: r.department,
      year: r.year,
      section: r.section,
      status: r.computed_status,
      assignedAt: r.assignedAt,
      dueAt: r.dueAt,
      attemptId: r.attemptId,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt,
      score: r.score !== null ? parseFloat(r.score) : null,
      percentage: r.percentage !== null ? parseFloat(r.percentage) : null
    };

    if (r.computed_status === 'IN_PROGRESS' && r.startedAt) {
      const expiresAt = new Date(new Date(r.startedAt).getTime() + assessment.duration_minutes * 60000);
      resObj.expiresAt = expiresAt;
      resObj.progress = {
        totalQuestions: totalQ,
        answeredQuestions: answeredQ,
        unansweredQuestions: totalQ - answeredQ,
        progressPercentage: progressPercentage
      };
    }
    
    return resObj;
  });

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      durationMinutes: assessment.duration_minutes
    },
    students,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  };
}

async function getAssignmentMonitoringDetails(assignmentId) {
  await autoSubmitExpiredAttempts();
  await _expireOldAssignments(pool);

  const query = `
    SELECT 
      asg.id as "assignmentId", asg.status as asg_status, asg.assigned_at, asg.due_at,
      s.id as "studentId", s.register_number, s.full_name, s.email,
      a.id as "assessmentId", a.title, a.duration_minutes, a.total_marks,
      att.id as "attemptId", att.status as att_status, att.started_at, att.submitted_at,
      (SELECT COUNT(*) FROM attempt_questions aq WHERE aq.attempt_id = att.id) as "total_q",
      (SELECT COUNT(*) FROM answers ans WHERE ans.attempt_id = att.id AND ans.selected_option IS NOT NULL) as "ans_q",
      r.score, r.percentage, r.correct_answers, r.wrong_answers, r.unanswered, r.completed_at
    FROM assessment_assignments asg
    JOIN students s ON asg.student_id = s.id
    JOIN assessments a ON asg.assessment_id = a.id
    LEFT JOIN attempts att ON asg.id = att.assignment_id
    LEFT JOIN results r ON att.id = r.attempt_id
    WHERE asg.id = $1
  `;
  const res = await pool.query(query, [assignmentId]);
  if (res.rows.length === 0) throw new Error('ASSIGNMENT_NOT_FOUND');
  const r = res.rows[0];

  let computedStatus = 'ASSIGNED';
  if (r.att_status === 'AUTO_SUBMITTED') computedStatus = 'AUTO_SUBMITTED';
  else if (r.att_status === 'SUBMITTED') computedStatus = 'COMPLETED';
  else if (r.att_status === 'IN_PROGRESS') computedStatus = 'IN_PROGRESS';
  else if (r.asg_status === 'EXPIRED') computedStatus = 'EXPIRED';

  const totalQ = parseInt(r.total_q || 0, 10);
  const ansQ = parseInt(r.ans_q || 0, 10);
  let progPct = 0;
  if (totalQ > 0) progPct = parseFloat(((ansQ / totalQ) * 100).toFixed(2));

  let attemptData = null;
  if (r.attemptId) {
    attemptData = {
      id: r.attemptId,
      status: r.att_status, // Using raw attempt status is fine, or computed
      startedAt: r.started_at,
      expiresAt: new Date(new Date(r.started_at).getTime() + r.duration_minutes * 60000),
      totalQuestions: totalQ,
      answeredQuestions: ansQ,
      unansweredQuestions: totalQ - ansQ,
      progressPercentage: progPct
    };
  }

  let resultData = null;
  if (r.completed_at) {
    resultData = {
      score: parseFloat(r.score),
      totalMarks: r.total_marks,
      percentage: parseFloat(r.percentage),
      correctAnswers: r.correct_answers,
      wrongAnswers: r.wrong_answers,
      unanswered: r.unanswered,
      completedAt: r.completed_at
    };
  }

  return {
    assignment: {
      id: r.assignmentId,
      status: computedStatus,
      assignedAt: r.assigned_at,
      dueAt: r.due_at
    },
    student: {
      id: r.studentId,
      registerNumber: r.register_number,
      fullName: r.full_name,
      email: r.email
    },
    assessment: {
      id: r.assessmentId,
      title: r.title,
      durationMinutes: r.duration_minutes,
      totalMarks: r.total_marks
    },
    attempt: attemptData,
    result: resultData
  };
}

module.exports = {
  getDashboardOverview,
  getRecentActivity,
  getLiveMonitoringFeed,
  getAssessmentSummaries,
  getAssessmentMonitoring,
  getAssignmentMonitoringDetails
};
