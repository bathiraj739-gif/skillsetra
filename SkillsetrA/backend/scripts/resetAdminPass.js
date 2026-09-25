const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetAdminPassword() {
  const username = 'admin';
  const password = 'CMS@Admin';
  const hash = await bcrypt.hash(password, 12);

  await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, username]);
  console.log(`Successfully updated admin password for '${username}'`);
  await pool.end();
}

resetAdminPassword();
