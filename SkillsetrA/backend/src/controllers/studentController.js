const pool = require('../config/db');
const authService = require('../services/authService');
const emailService = require('../services/emailService');

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
    let querySql = `
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
      WHERE (s.id::text = $1 OR s.user_id::text = $1)
    `;
    let queryParams = [id];

    if (id === 'me') {
      querySql = `
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
        WHERE s.user_id = $1
      `;
      queryParams = [req.user.userId];
    }

    const result = await pool.query(querySql, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = result.rows[0];

    // Authorization check: Students can only view their own profile
    if (req.user.role === 'student' && student.user_id !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only view your own profile.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        student
      },
      student
    });
  } catch (err) {
    next(err);
  }
}

async function createStudent(req, res, next) {
  try {
    const studentData = req.body;
    
    const fullName = (studentData.fullName || studentData.full_name || studentData.name || '').trim();
    const registerNumber = (studentData.registerNumber || studentData.register_number || studentData.studentId || '').trim();
    const username = (studentData.username || registerNumber || studentData.email || '').trim();
    const password = (studentData.password || '').trim();
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
        fullName: result.student.full_name,
        name: result.student.full_name,
        register_number: result.student.register_number,
        registerNumber: result.student.register_number,
        studentId: result.student.register_number,
        email: result.student.email,
        department: result.student.department,
        year: result.student.year,
        yearOfStudy: result.student.year,
        section: result.student.section,
      };

      // Send Welcome Email if student has email address (non-blocking for student creation)
      let emailResult = { sent: false };
      if (email) {
        emailResult = await emailService.sendStudentWelcomeEmail({
          to: email,
          studentName: fullName,
          registerNumber,
          username,
          initialPassword: password,
          studentId: result.student.id
        });
      }

      const emailStatus = {
        sent: Boolean(emailResult.sent || emailResult.simulated),
        simulated: Boolean(emailResult.simulated),
        messageId: emailResult.messageId || null,
        error: emailResult.error || null
      };

      return res.status(201).json({
        success: true,
        message: emailResult.sent
          ? 'Student account created and welcome email sent successfully.'
          : (email && emailResult.error
              ? 'Student account created successfully, but welcome email could not be sent.'
              : 'Student account created successfully.'),
        data: {
          ...studentResponse,
          student: studentResponse,
          email: emailStatus
        },
        student: studentResponse,
        email: emailStatus
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

    await client.query('BEGIN');

    // Find student by UUID or user_id or 'me'
    let check;
    if (id === 'me') {
      check = await client.query('SELECT * FROM students WHERE user_id = $1', [req.user.userId]);
    } else {
      check = await client.query('SELECT * FROM students WHERE (id::text = $1 OR user_id::text = $1)', [id]);
    }

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const current = check.rows[0];

    // Authorization check: Students can only update their own profile
    if (req.user.role === 'student' && current.user_id !== req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update your own profile.'
      });
    }

    // Allowed profile fields
    const fullName = data.full_name !== undefined ? (data.full_name?.trim() || null) : (data.name !== undefined ? (data.name?.trim() || null) : undefined);
    const department = data.department !== undefined ? (data.department?.trim() || null) : undefined;
    const year = data.year !== undefined ? String(data.year).trim() : (data.yearOfStudy !== undefined ? String(data.yearOfStudy).trim() : undefined);
    const section = data.section !== undefined ? (data.section?.trim() || null) : undefined;
    const phone = data.phone !== undefined ? (data.phone?.trim() || null) : undefined;

    // Protected fields: ONLY Admin can update register_number and email
    let registerNumber = current.register_number;
    let email = current.email;

    if (req.user.role === 'admin') {
      if (data.register_number !== undefined || data.registerNumber !== undefined) {
        registerNumber = (data.register_number || data.registerNumber)?.trim() || current.register_number;
      }
      if (data.email !== undefined) {
        email = data.email?.trim() || null;
      }
    }

    const updateRes = await client.query(
      `UPDATE students
       SET full_name = COALESCE($1, full_name),
           register_number = $2,
           email = $3,
           department = COALESCE($4, department),
           year = COALESCE($5, year),
           section = COALESCE($6, section),
           phone = COALESCE($7, phone),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        fullName !== undefined ? fullName : null,
        registerNumber,
        email,
        department !== undefined ? department : current.department,
        year !== undefined ? year : current.year,
        section !== undefined ? section : current.section,
        phone !== undefined ? phone : current.phone,
        current.id
      ]
    );

    const updated = updateRes.rows[0];
    await client.query('COMMIT');

    // Trigger profile updated email asynchronously post-commit
    if (updated.email) {
      emailService.sendProfileUpdatedEmail({
        to: updated.email,
        studentName: updated.full_name,
        name: updated.full_name,
        registerNumber: updated.register_number,
        department: updated.department,
        year: updated.year
      }).catch(err => {
        console.error('[PROFILE EMAIL ERROR]', err.message || err);
      });
    }

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
      phone: updated.phone,
      updated_at: updated.updated_at
    };

    return res.status(200).json({
      success: true,
      message: 'Student profile updated successfully',
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

async function bulkValidateCandidates(req, res, next) {
  try {
    const { candidates } = req.body;

    if (!Array.isArray(candidates)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input: candidates must be an array.'
      });
    }

    const existingUsersRes = await pool.query('SELECT LOWER(username) AS username FROM users');
    const existingStudentsRes = await pool.query('SELECT LOWER(register_number) AS register_number, LOWER(email) AS email FROM students');

    const existingUsernames = new Set(existingUsersRes.rows.map(r => r.username));
    const existingRegNumbers = new Set(existingStudentsRes.rows.map(r => r.register_number));
    const existingEmails = new Set(existingStudentsRes.rows.map(r => r.email).filter(Boolean));

    const seenRegNumbersInBatch = new Set();
    const seenUsernamesInBatch = new Set();
    const seenEmailsInBatch = new Set();

    let totalRows = 0;
    let validCount = 0;
    let invalidCount = 0;
    let alreadyRegisteredCount = 0;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validatedRows = candidates.map((c, index) => {
      const rowNum = index + 1;
      
      const registerNumber = (c.register_number || c.registerNumber || c['Register Number'] || c['Register No'] || c['Reg No'] || '').toString().trim();
      const fullName = (c.full_name || c.fullName || c.name || c['Full Name'] || c['Name'] || '').toString().trim();
      const email = (c.email || c['Email'] || c['Email Address'] || '').toString().trim();
      const department = (c.department || c['Department'] || c['Dept'] || '').toString().trim();
      const yearRaw = c.year != null ? c.year : (c.yearOfStudy || c['Year'] || c['Academic Year']);
      const year = yearRaw != null ? String(yearRaw).trim() : '';
      const section = (c.section || c['Section'] || '').toString().trim();
      const phone = (c.phone || c['Phone'] || c['Mobile'] || c['Contact'] || '').toString().trim();
      const username = (c.username || c['Username'] || registerNumber).toString().trim();

      const isCompletelyEmpty = !registerNumber && !fullName && !email && !department && !year && !section && !phone;
      if (isCompletelyEmpty) {
        return null;
      }

      totalRows++;

      const errors = [];
      const lowerReg = registerNumber.toLowerCase();
      const lowerUser = username.toLowerCase();
      const lowerEmail = email.toLowerCase();

      if (!registerNumber) {
        errors.push('Register Number is required');
      }
      if (!fullName) {
        errors.push('Full Name is required');
      }
      if (email && !emailRegex.test(email)) {
        errors.push('Invalid email format');
      }

      if (registerNumber && seenRegNumbersInBatch.has(lowerReg)) {
        errors.push('Duplicate Register Number in Excel file');
      }
      if (username && seenUsernamesInBatch.has(lowerUser)) {
        errors.push('Duplicate Username in Excel file');
      }
      if (email && seenEmailsInBatch.has(lowerEmail)) {
        errors.push('Duplicate Email in Excel file');
      }

      const isAlreadyInDb = 
        (registerNumber && existingRegNumbers.has(lowerReg)) ||
        (username && existingUsernames.has(lowerUser)) ||
        (email && existingEmails.has(lowerEmail));

      let status = 'valid';

      if (isAlreadyInDb) {
        status = 'already_registered';
        alreadyRegisteredCount++;
        errors.push('Candidate already registered in the system');
      } else if (errors.length > 0) {
        status = 'invalid';
        invalidCount++;
      } else {
        validCount++;
        if (registerNumber) seenRegNumbersInBatch.add(lowerReg);
        if (username) seenUsernamesInBatch.add(lowerUser);
        if (email) seenEmailsInBatch.add(lowerEmail);
      }

      return {
        rowNumber: rowNum,
        status,
        errors,
        candidate: {
          register_number: registerNumber,
          full_name: fullName,
          username: username || registerNumber,
          email: email || null,
          department: department || null,
          year: year || null,
          section: section || null,
          phone: phone || null
        }
      };
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        totalRows,
        validCount,
        invalidCount,
        alreadyRegisteredCount,
        rows: validatedRows
      }
    });
  } catch (err) {
    next(err);
  }
}

async function bulkImportCandidates(req, res, next) {
  try {
    const { candidates, initialPassword } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidates provided for import.'
      });
    }

    if (!initialPassword || initialPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Initial password is required and must be at least 6 characters long.'
      });
    }

    let registeredCount = 0;
    let skippedCount = 0;
    const errorsList = [];
    const createdStudentsForEmail = [];

    for (const c of candidates) {
      const registerNumber = (c.register_number || c.registerNumber || '').trim();
      const fullName = (c.full_name || c.name || '').trim();
      const username = (c.username || registerNumber || '').trim();
      const email = (c.email || '').trim() || null;
      const department = (c.department || '').trim() || null;
      const year = c.year != null ? String(c.year) : null;
      const section = (c.section || '').trim() || null;
      const phone = (c.phone || '').trim() || null;

      if (!registerNumber || !fullName || !username) {
        skippedCount++;
        continue;
      }

      try {
        const created = await authService.createStudentAccount({
          username,
          password: initialPassword,
          full_name: fullName,
          register_number: registerNumber,
          email,
          department,
          year,
          section,
          phone
        });
        registeredCount++;
        if (email) {
          createdStudentsForEmail.push({
            id: created.student.id,
            full_name: fullName,
            register_number: registerNumber,
            username,
            email,
            initialPassword
          });
        }
      } catch (err) {
        skippedCount++;
        errorsList.push({ register_number: registerNumber, error: err.message });
      }
    }

    // Send bulk emails with controlled concurrency for all successfully created candidates
    let emailSummary = { sentCount: 0, failedCount: 0 };
    if (createdStudentsForEmail.length > 0) {
      emailSummary = await emailService.sendBulkStudentWelcomeEmails(createdStudentsForEmail);
    }

    return res.status(200).json({
      success: true,
      message: `Bulk candidate registration completed. ${registeredCount} registered, ${skippedCount} skipped. ${emailSummary.sentCount} welcome emails sent.`,
      data: {
        registeredCount,
        skippedCount,
        errors: errorsList,
        emails: {
          totalSent: emailSummary.sentCount,
          totalFailed: emailSummary.failedCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

async function sendWelcomeEmail(req, res, next) {
  try {
    const { id } = req.params;
    const { initialPassword } = req.body || {};

    const studentRes = await pool.query(`
      SELECT s.id, s.full_name, s.register_number, s.email, u.username
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id::text = $1 OR s.user_id::text = $1
    `, [id]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const student = studentRes.rows[0];
    if (!student.email) {
      return res.status(400).json({
        success: false,
        message: 'Student does not have a registered email address'
      });
    }

    const emailResult = await emailService.sendStudentWelcomeEmail({
      to: student.email,
      studentName: student.full_name,
      registerNumber: student.register_number,
      username: student.username,
      initialPassword: initialPassword || null,
      studentId: student.id
    });

    if (!emailResult.success && !emailResult.simulated) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || 'Failed to send welcome email via Resend',
        email: { sent: false }
      });
    }

    return res.status(200).json({
      success: true,
      message: emailResult.simulated
        ? `Welcome email prepared (simulated in dev environment) for ${student.email}`
        : `Welcome email sent successfully to ${student.email}`,
      data: {
        sent: Boolean(emailResult.sent || emailResult.simulated),
        simulated: Boolean(emailResult.simulated),
        messageId: emailResult.messageId || null,
        recipient: student.email
      }
    });
  } catch (err) {
    next(err);
  }
}

async function sendTestEmail(req, res, next) {
  try {
    const { to } = req.body;
    if (!to || typeof to !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Recipient email address ("to") is required.'
      });
    }

    const result = await emailService.sendTestEmail({ to: to.trim() });
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to send test email via Resend.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${to}`,
      data: {
        recipient: to,
        messageId: result.messageId || null
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkValidateCandidates,
  bulkImportCandidates,
  sendWelcomeEmail,
  sendTestEmail
};
