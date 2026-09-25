const pool = require('../config/db');
const authService = require('../services/authService');

async function getStudents(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.user_id,
        u.username,
        s.full_name,
        s.full_name AS name,
        s.email,
        s.register_number,
        s.register_number AS "registerNumber",
        s.department,
        s.year,
        s.year AS "yearOfStudy",
        s.section,
        s.phone,
        u.is_active,
        s.created_at,
        s.updated_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: {
        students: result.rows
      },
      students: result.rows
    });
  } catch (err) {
    next(err);
  }
}

async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        s.id,
        s.user_id,
        u.username,
        s.full_name,
        s.full_name AS name,
        s.email,
        s.register_number,
        s.register_number AS "registerNumber",
        s.department,
        s.year,
        s.year AS "yearOfStudy",
        s.section,
        s.phone,
        u.is_active,
        s.created_at,
        s.updated_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1 OR s.user_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        student: result.rows[0]
      },
      student: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function createStudent(req, res, next) {
  try {
    const studentData = req.body;
    
    const fullName = (studentData.full_name || studentData.name || '').trim();
    const username = (studentData.username || '').trim();
    const password = (studentData.password || '').trim();
    const registerNumber = (studentData.register_number || studentData.registerNumber || '').trim();
    const email = (studentData.email || '').trim() || null;
    const department = (studentData.department || '').trim() || null;
    const year = studentData.year != null ? String(studentData.year) : (studentData.yearOfStudy || null);
    const section = (studentData.section || '').trim() || null;

    if (!username || !password || !registerNumber || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: username, password, full_name, and register_number are required.'
      });
    }

    try {
      const result = await authService.createStudentAccount({
        username,
        password,
        full_name: fullName,
        register_number: registerNumber,
        email,
        department,
        year,
        section
      });

      const studentResponse = {
        id: result.student.id,
        user_id: result.user.id,
        username: result.user.username,
        full_name: result.student.full_name,
        name: result.student.full_name,
        register_number: result.student.register_number,
        registerNumber: result.student.register_number,
        email: result.student.email,
        department: result.student.department,
        year: result.student.year,
        yearOfStudy: result.student.year,
        section: result.student.section,
      };

      return res.status(201).json({
        success: true,
        message: 'Student account created successfully',
        data: {
          student: studentResponse
        },
        student: studentResponse
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  } catch (err) {
    next(err);
  }
}

async function updateStudent(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const data = req.body;

    const fullName = data.full_name || data.name;
    const registerNumber = data.register_number || data.registerNumber;
    const email = data.email !== undefined ? (data.email?.trim() || null) : undefined;
    const department = data.department !== undefined ? (data.department?.trim() || null) : undefined;
    const year = data.year !== undefined ? String(data.year) : (data.yearOfStudy !== undefined ? data.yearOfStudy : undefined);
    const section = data.section !== undefined ? (data.section?.trim() || null) : undefined;

    await client.query('BEGIN');

    // Find student
    const check = await client.query('SELECT * FROM students WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const current = check.rows[0];

    const updateRes = await client.query(
      `UPDATE students
       SET full_name = COALESCE($1, full_name),
           register_number = COALESCE($2, register_number),
           email = COALESCE($3, email),
           department = COALESCE($4, department),
           year = COALESCE($5, year),
           section = COALESCE($6, section),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        fullName || null,
        registerNumber || null,
        email !== undefined ? email : current.email,
        department !== undefined ? department : current.department,
        year !== undefined ? year : current.year,
        section !== undefined ? section : current.section,
        id
      ]
    );

    const updated = updateRes.rows[0];
    await client.query('COMMIT');

    const studentResponse = {
      id: updated.id,
      user_id: updated.user_id,
      full_name: updated.full_name,
      name: updated.full_name,
      register_number: updated.register_number,
      registerNumber: updated.register_number,
      email: updated.email,
      department: updated.department,
      year: updated.year,
      yearOfStudy: updated.year,
      section: updated.section,
    };

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: {
        student: studentResponse
      },
      student: studentResponse
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function deleteStudent(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Find student to get user_id
    const check = await client.query('SELECT user_id FROM students WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userId = check.rows[0].user_id;

    // Delete user which cascades to student
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
};
