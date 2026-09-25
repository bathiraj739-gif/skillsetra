const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);
    const tables = {};
    res.rows.forEach(r => {
      tables[r.table_name] = tables[r.table_name] || [];
      tables[r.table_name].push(`${r.column_name} (${r.data_type})`);
    });
    console.log(JSON.stringify(tables, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run();
