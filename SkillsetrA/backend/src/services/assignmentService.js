const pool = require('../config/db');

async function createAssignments(data, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assessmentId, studentIds, dueAt } = data;
    if (!assessmentId) throw new Error('ASSESSMENT_REQUIRED');
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new Error('STUDENTS_REQUIRED');
    }

    // Validate assessment
    const assRes = await client.query(`SELECT id, status, duration_minutes, total_marks FROM assessments WHERE id = $1`, [assessmentId]);
    if (assRes.rows.length === 0) throw new Error('ASSESSMENT_NOT_FOUND');
    const assessment = assRes.rows[0];

    if (assessment.status === 'DRAFT') throw new Error('ASSESSMENT_IS_DRAFT');
    if (assessment.status === 'CLOSED') throw new Error('ASSESSMENT_IS_CLOSED');
    
    const qCount = await client.query(`SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = $1`, [assessmentId]);
    if (parseInt(qCount.rows[0].count, 10) === 0 || assessment.duration_minutes <= 0 || assessment.total_marks <= 0) {
      throw new Error('ASSESSMENT_INVALID_CONFIG');
    }

    // Validate students
    const uniqueStudentIds = [...new Set(studentIds)];
    const stuRes = await client.query(
      `SELECT id FROM students WHERE id = ANY($1::uuid[])`, 
      [uniqueStudentIds]
    );
    if (stuRes.rows.length !== uniqueStudentIds.length) {
      throw new Error('INVALID_STUDENTS');
    }

    // Check existing assignments
    const existingRes = await client.query(
      `SELECT student_id FROM assessment_assignments WHERE assessment_id = $1 AND student_id = ANY($2::uuid[])`,
      [assessmentId, uniqueStudentIds]
    );
    const existingStudentIds = existingRes.rows.map(r => r.student_id);

    const newStudentIds = uniqueStudentIds.filter(id => !existingStudentIds.includes(id));
    const createdAssignments = [];

    // Insert new assignments
    for (const stuId of newStudentIds) {
      const insertRes = await client.query(
        `INSERT INTO assessment_assignments (assessment_id, student_id, assigned_by, due_at, status)
         VALUES ($1, $2, $3, $4, 'ASSIGNED') RETURNING *`,
        [assessmentId, stuId, adminUserId, dueAt || null]
      );
      const assignment = insertRes.rows[0];
      createdAssignments.push(assignment);

      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
        [adminUserId, 'ASSIGNMENT_CREATED', 'assessment_assignment', assignment.id]
      );
    }

    await client.query('COMMIT');
    return {
      assigned: createdAssignments,
      alreadyAssigned: existingStudentIds
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function _expireOldAssignments(client) {
  // Update expired assignments globally, returning count for internal logic
  // Not heavily optimized for large scale but fits requirements
  await client.query(
    `UPDATE assessment_assignments 
     SET status = 'EXPIRED' 
     WHERE status = 'ASSIGNED' AND due_at IS NOT NULL AND due_at < NOW()`
  );
}

async function getAssignments(filters) {
  await _expireOldAssignments(pool);

  const { assessmentId, studentId, status, search, page = 1, limit = 20 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  let queryParams = [];
  let whereClauses = [];
  let paramIndex = 1;

  if (assessmentId) {
    whereClauses.push(`aa.assessment_id = $${paramIndex++}`);
    queryParams.push(assessmentId);
  }
  if (studentId) {
    whereClauses.push(`aa.student_id = $${paramIndex++}`);
    queryParams.push(studentId);
  }
  if (status) {
    whereClauses.push(`aa.status = $${paramIndex++}`);
    queryParams.push(status);
  }
  if (search) {
    whereClauses.push(`(s.full_name ILIKE $${paramIndex} OR s.register_number ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) FROM assessment_assignments aa
    JOIN students s ON aa.student_id = s.id
    ${whereString}
  `;
  const countRes = await pool.query(countQuery, queryParams);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    SELECT 
      aa.id, aa.status, aa.assigned_at, aa.due_at,
      a.id as "assessment_id", a.title as "assessment_title", a.duration_minutes, a.total_marks,
      s.id as "student_id", s.register_number, s.full_name, s.email, s.department, s.year, s.section
    FROM assessment_assignments aa
    JOIN assessments a ON aa.assessment_id = a.id
    JOIN students s ON aa.student_id = s.id
    ${whereString}
    ORDER BY aa.assigned_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...queryParams, parsedLimit, offset]);

  const assignments = dataRes.rows.map(r => ({
    id: r.id,
    status: r.status,
    assigned_at: r.assigned_at,
    due_at: r.due_at,
    due_date: r.due_at,
    candidate_name: r.full_name,
    student_name: r.full_name,
    full_name: r.full_name,
    register_number: r.register_number,
    department: r.department,
    assessment: {
      id: r.assessment_id,
      title: r.assessment_title,
      duration_minutes: r.duration_minutes,
      total_marks: r.total_marks
    },
    student: {
      id: r.student_id,
      name: r.full_name,
      full_name: r.full_name,
      fullName: r.full_name,
      register_number: r.register_number,
      registerNumber: r.register_number,
      email: r.email,
      department: r.department,
      year: r.year,
      section: r.section
    }
  }));

  return {
    assignments,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  };
}

async function getAssignmentById(id) {
  await _expireOldAssignments(pool);
  const query = `
    SELECT 
      aa.id, aa.status, aa.assigned_at, aa.due_at,
      a.id as "assessment_id", a.title as "assessment_title", a.description, a.duration_minutes, a.total_marks,
      s.id as "student_id", s.register_number, s.full_name, s.email, s.department, s.year, s.section
    FROM assessment_assignments aa
    JOIN assessments a ON aa.assessment_id = a.id
    JOIN students s ON aa.student_id = s.id
    WHERE aa.id = $1
  `;
  const res = await pool.query(query, [id]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    status: r.status,
    assigned_at: r.assigned_at,
    due_at: r.due_at,
    assessment: {
      id: r.assessment_id,
      title: r.assessment_title,
      description: r.description,
      duration_minutes: r.duration_minutes,
      total_marks: r.total_marks
    },
    student: {
      id: r.student_id,
      register_number: r.register_number,
      full_name: r.full_name,
      email: r.email,
      department: r.department,
      year: r.year,
      section: r.section
    }
  };
}

async function updateAssignment(id, data, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checkRes = await client.query(`SELECT status FROM assessment_assignments WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) throw new Error('NOT_FOUND');
    
    // allow update even if expired/inprogress based on requirements (only restricted for attempts if we want, but instructions say dueAt update is allowed unless attempt explicitly blocked? The instruction says "Do not modify assignments that already have an attempt unless explicitly supported later." We will block if attempt exists.)
    const attemptCheck = await client.query(`SELECT 1 FROM attempts WHERE assignment_id = $1 LIMIT 1`, [id]);
    if (attemptCheck.rows.length > 0) throw new Error('ATTEMPT_EXISTS');

    const updatedRes = await client.query(
      `UPDATE assessment_assignments SET due_at = $1 WHERE id = $2 RETURNING *`,
      [data.dueAt || null, id]
    );

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [adminUserId, 'ASSIGNMENT_UPDATED', 'assessment_assignment', id]
    );

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteAssignment(id, adminUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const checkRes = await client.query(`SELECT status FROM assessment_assignments WHERE id = $1`, [id]);
    if (checkRes.rows.length === 0) throw new Error('NOT_FOUND');

    const attemptCheck = await client.query(`SELECT 1 FROM attempts WHERE assignment_id = $1 LIMIT 1`, [id]);
    if (attemptCheck.rows.length > 0) {
      throw new Error('ATTEMPT_EXISTS');
    }

    await client.query(`DELETE FROM assessment_assignments WHERE id = $1`, [id]);

    await client.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)`,
      [adminUserId, 'ASSIGNMENT_DELETED', 'assessment_assignment', id]
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

// Student specific service functions
async function getStudentAssignments(studentUserId) {
  await _expireOldAssignments(pool);
  
  // Resolve studentId from userId
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const query = `
    SELECT 
      aa.id, aa.assessment_id, aa.status, aa.assigned_at, aa.due_at,
      a.title, a.description, a.duration_minutes, a.total_marks, a.status as "assessment_status",
      COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'APTITUDE'), 0) AS aptitude_count,
      COALESCE((SELECT COUNT(*) FROM assessment_questions aq JOIN questions q ON aq.question_id = q.id WHERE aq.assessment_id = a.id AND q.category = 'VERBAL'), 0) AS verbal_count
    FROM assessment_assignments aa
    JOIN assessments a ON aa.assessment_id = a.id
    WHERE aa.student_id = $1
    ORDER BY aa.assigned_at DESC
  `;
  const res = await pool.query(query, [studentId]);
  
  return res.rows.map(r => ({
    id: r.id,
    assessment_id: r.assessment_id,
    student_id: studentId,
    status: (r.status || 'ASSIGNED').toLowerCase(),
    assigned_at: r.assigned_at,
    due_at: r.due_at,
    due_date: r.due_at,
    assessmentId: r.assessment_id,
    title: r.title,
    description: r.description,
    durationMinutes: r.duration_minutes,
    totalMarks: r.total_marks,
    aptitude_count: parseInt(r.aptitude_count || 0, 10),
    verbal_count: parseInt(r.verbal_count || 0, 10),
    assessment: {
      id: r.assessment_id,
      title: r.title,
      description: r.description,
      duration_minutes: r.duration_minutes,
      total_marks: r.total_marks,
      status: r.assessment_status,
      aptitude_count: parseInt(r.aptitude_count || 0, 10),
      verbal_count: parseInt(r.verbal_count || 0, 10),
      passing_percentage: 50,
    }
  }));
}

async function getStudentAssignmentById(assignmentId, studentUserId) {
  await _expireOldAssignments(pool);
  
  const studentRes = await pool.query(`SELECT id FROM students WHERE user_id = $1`, [studentUserId]);
  if (studentRes.rows.length === 0) throw new Error('STUDENT_NOT_FOUND');
  const studentId = studentRes.rows[0].id;

  const query = `
    SELECT 
      aa.id, aa.student_id, aa.assessment_id, a.title, a.description, a.duration_minutes, a.total_marks,
      aa.status, aa.assigned_at, aa.due_at
    FROM assessment_assignments aa
    JOIN assessments a ON aa.assessment_id = a.id
    WHERE aa.id = $1
  `;
  const res = await pool.query(query, [assignmentId]);
  
  if (res.rows.length === 0) return null;
  const assignment = res.rows[0];

  if (assignment.student_id !== studentId) {
    throw new Error('UNAUTHORIZED_ACCESS');
  }

  return {
    id: assignment.id,
    assessmentId: assignment.assessment_id,
    title: assignment.title,
    description: assignment.description,
    durationMinutes: assignment.duration_minutes,
    totalMarks: assignment.total_marks,
    status: assignment.status,
    assignedAt: assignment.assigned_at,
    dueAt: assignment.due_at
  };
}

module.exports = {
  createAssignments,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getStudentAssignments,
  getStudentAssignmentById
};
