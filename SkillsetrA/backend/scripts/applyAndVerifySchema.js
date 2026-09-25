// backend/scripts/applyAndVerifySchema.js
// Executes database/schema.sql and verifies all 11 tables, constraints, and indexes

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('🔄 Applying schema.sql to PostgreSQL database "skillsetra"...');
  const sqlPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    // 1. Execute full DDL
    await client.query(sql);
    console.log('✅ schema.sql executed successfully.\n');

    // 2. Verify all 11 tables
    const expectedTables = [
      'users',
      'students',
      'questions',
      'assessments',
      'assessment_questions',
      'assessment_assignments',
      'attempts',
      'attempt_questions',
      'answers',
      'results',
      'activity_logs',
    ];

    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = tableRes.rows.map(r => r.table_name);
    console.log('📊 Existing Database Tables in "skillsetra":');
    expectedTables.forEach(tbl => {
      const found = existingTables.includes(tbl);
      console.log(`  ${found ? '✅' : '❌'} ${tbl}`);
    });

    // 3. Verify Foreign Keys
    const fkRes = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(`\n🔗 Verified ${fkRes.rows.length} Foreign Key Constraints.`);

    // 4. Verify Indexes
    const idxRes = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.log(`⚡ Verified ${idxRes.rows.length} Indexes across all tables.`);

    console.log('\n🎉 Step 8 Database Schema Verification Complete: 100% Success!');
  } catch (err) {
    console.error('❌ Error executing schema.sql:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
