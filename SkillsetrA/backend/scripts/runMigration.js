const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('../src/config/db');

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔄 Executing Migration 001: Next-Level Intelligence Features...');
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '001_next_level_intelligence.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('✅ Migration applied successfully.');

    // Verify columns on assessments
    const colRes = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'assessments' AND column_name IN ('assessment_mode', 'starting_difficulty', 'min_questions', 'max_questions');
    `);
    console.log('📊 Verified Assessment Columns:', colRes.rows);

    // Verify indexes
    const idxRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname IN (
        'idx_questions_cat_diff_active',
        'idx_answers_question_id',
        'idx_answers_is_correct',
        'idx_attempt_questions_question_id',
        'idx_attempts_status',
        'idx_results_completed_at'
      );
    `);
    console.log('📊 Verified Performance Indexes:', idxRes.rows);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
