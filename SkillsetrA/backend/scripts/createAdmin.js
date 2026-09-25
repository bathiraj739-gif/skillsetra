require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Error: ADMIN_USERNAME and ADMIN_PASSWORD must be configured in environment variables.');
    process.exit(1);
  }

  const client = await pool.connect();
  
  try {
    // Check if an admin already exists
    const adminCheck = await client.query(`SELECT COUNT(*) FROM users WHERE role = 'admin'`);
    const count = parseInt(adminCheck.rows[0].count, 10);
    
    if (count > 0) {
      console.log('An admin account already exists. Refusing to create another one.');
      process.exit(0);
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Insert the single admin
    await client.query(
      `INSERT INTO users (username, password_hash, role, is_active)
       VALUES ($1, $2, 'admin', true)`,
      [username, passwordHash]
    );
    
    console.log(`Success: Master Admin account '${username}' created securely.`);
  } catch (err) {
    console.error('Error creating Admin:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

createAdmin();
