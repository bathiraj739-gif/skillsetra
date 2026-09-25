const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

const SALT_ROUNDS = 12;

async function adminLogin(username, password) {
  const result = await pool.query(
    `SELECT id, username, password_hash, role, is_active 
     FROM users 
     WHERE (LOWER(username) = LOWER($1) OR ($1 ILIKE '%admin%' AND role = 'admin')) 
     AND role = 'admin'`,
    [username]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  
  if (!user.is_active) {
    return null;
  }
  
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return null;
  }
  
  const token = generateToken(user);
  
  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    token
  };
}

async function studentLogin(username, password) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.password_hash, u.role, u.is_active 
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     WHERE (LOWER(u.username) = LOWER($1) OR LOWER(s.email) = LOWER($1) OR LOWER(s.register_number) = LOWER($1))
     AND u.role = 'student'`,
    [username]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  
  if (!user.is_active) {
    return null;
  }
  
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return null;
  }
  
  const studentResult = await pool.query(
    `SELECT id, register_number, full_name, email, department, year, section FROM students WHERE user_id = $1`,
    [user.id]
  );
  
  if (studentResult.rows.length === 0) {
    return null;
  }
  
  const student = studentResult.rows[0];
  const token = generateToken(user);
  
  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    student: {
      id: student.id,
      register_number: student.register_number,
      full_name: student.full_name,
      email: student.email,
      department: student.department,
      year: student.year,
      section: student.section
    },
    token
  };
}

async function getUserById(userId) {
  const userResult = await pool.query(
    `SELECT id, username, role, is_active FROM users WHERE id = $1`,
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    return null;
  }
  
  const user = userResult.rows[0];
  
  if (user.role === 'admin') {
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  } else if (user.role === 'student') {
    const studentResult = await pool.query(
      `SELECT id, register_number, full_name, email, department, year, section FROM students WHERE user_id = $1`,
      [user.id]
    );
    const student = studentResult.rows[0];
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      student: student ? {
        id: student.id,
        register_number: student.register_number,
        full_name: student.full_name,
        email: student.email,
        department: student.department,
        year: student.year,
        section: student.section
      } : null
    };
  }
  return null;
}

async function createStudentAccount(studentData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if username exists
    const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [studentData.username]);
    if (userCheck.rows.length > 0) {
      throw new Error('Username already exists');
    }
    
    // Check if register number exists
    const regCheck = await client.query('SELECT id FROM students WHERE register_number = $1', [studentData.register_number]);
    if (regCheck.rows.length > 0) {
      throw new Error('Register number already exists');
    }

    // Check if email exists
    if (studentData.email) {
      const emailCheck = await client.query('SELECT id FROM students WHERE email = $1', [studentData.email]);
      if (emailCheck.rows.length > 0) {
        throw new Error('Email address already registered with another account');
      }
    }

    const passwordHash = await bcrypt.hash(studentData.password, SALT_ROUNDS);
    
    // Insert into users
    const userInsert = await client.query(
      `INSERT INTO users (username, password_hash, role, is_active)
       VALUES ($1, $2, 'student', true) RETURNING id, username, role`,
      [studentData.username, passwordHash]
    );
    const user = userInsert.rows[0];
    
    // Insert into students
    const studentInsert = await client.query(
      `INSERT INTO students (user_id, register_number, full_name, email, department, year, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, register_number, full_name, email, department, year, section`,
      [
        user.id, 
        studentData.register_number, 
        studentData.full_name, 
        studentData.email || null, 
        studentData.department || null, 
        studentData.year || null, 
        studentData.section || null
      ]
    );
    const student = studentInsert.rows[0];
    
    await client.query('COMMIT');
    
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      student
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function changePassword(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new Error('Old password and new password are required');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long');
  }

  const userRes = await pool.query(`SELECT id, password_hash FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userRes.rows[0];
  const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, userId]);

  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'PASSWORD_UPDATED', 'user', userId, JSON.stringify({ timestamp: new Date() })]
    );
  } catch (logErr) {
    console.error('Failed to log password change activity:', logErr);
  }

  return true;
}

module.exports = {
  adminLogin,
  studentLogin,
  getUserById,
  createStudentAccount,
  changePassword
};
