require('dotenv').config();
const pool = require('../src/config/db');

const OFFICIAL_DEPARTMENTS = [
  'AI&DS',
  'AI&ML',
  'BME',
  'CSE',
  'CSE(CS)',
  'ECE',
  'EEE',
  'MECH'
];

async function standardize() {
  const client = await pool.connect();
  try {
    await client.query("UPDATE students SET department = 'AI&DS' WHERE department ILIKE '%Artificial Intelligence%' OR department ILIKE '%AI & DS%'");
    await client.query("UPDATE students SET department = 'CSE(CS)' WHERE department ILIKE '%Information Technology%' OR department = 'IT'");
    
    // Ensure all 8 departments exist with proper casing
    const res = await client.query('SELECT department, COUNT(*) FROM students GROUP BY department ORDER BY department');
    console.log('Current DB departments:', res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

standardize();
