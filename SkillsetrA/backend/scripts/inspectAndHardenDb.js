require("dotenv").config();
const pool = require("../src/config/db");

async function run() {
  console.log("=== Inspecting Database Indexes ===");
  const res = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  console.log(`Found ${res.rows.length} existing indexes:`);
  res.rows.forEach((r) => {
    console.log(`- [${r.tablename}] ${r.indexname}`);
  });

  console.log("\n=== Adding Missing Performance & Concurrency Indexes ===");

  const indexes = [
    // Users & Students
    "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    "CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);",
    "CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(register_number);",

    // Questions
    "CREATE INDEX IF NOT EXISTS idx_questions_category_difficulty ON questions(category, difficulty, is_active);",

    // Assessments & Assessment Questions
    "CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);",
    "CREATE INDEX IF NOT EXISTS idx_assessment_questions_ass_id ON assessment_questions(assessment_id);",
    "CREATE INDEX IF NOT EXISTS idx_assessment_questions_order ON assessment_questions(assessment_id, question_order);",

    // Assessment Assignments
    "CREATE INDEX IF NOT EXISTS idx_assignments_student_assessment ON assessment_assignments(student_id, assessment_id);",
    "CREATE INDEX IF NOT EXISTS idx_assignments_assessment_status ON assessment_assignments(assessment_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_assignments_due_status ON assessment_assignments(status, due_at);",

    // Attempts
    "CREATE INDEX IF NOT EXISTS idx_attempts_student_status ON attempts(student_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_attempts_assignment_id ON attempts(assignment_id);",
    "CREATE INDEX IF NOT EXISTS idx_attempts_assessment_status ON attempts(assessment_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_attempts_status_started ON attempts(status, started_at);",

    // Attempt Questions (Crucial for fast exam question fetch & ordering)
    "CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_order ON attempt_questions(attempt_id, question_order);",
    "CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt_question ON attempt_questions(attempt_id, question_id);",

    // Answers (Crucial for high concurrency autosave UPSERT and evaluation)
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_attempt_question_uniq ON answers(attempt_id, question_id);",
    "CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers(attempt_id);",

    // Results
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_results_attempt_id_uniq ON results(attempt_id);",
    "CREATE INDEX IF NOT EXISTS idx_results_student_assessment ON results(student_id, assessment_id);",
    "CREATE INDEX IF NOT EXISTS idx_results_assessment_completed ON results(assessment_id, completed_at);",

    // Activity Logs
    "CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);"
  ];

  for (const sql of indexes) {
    try {
      await pool.query(sql);
      console.log(`✓ Executed: ${sql.trim()}`);
    } catch (err) {
      console.warn(`! Warning on [${sql.trim()}]:`, err.message);
    }
  }

  console.log("\n=== Checking Unique Constraints ===");
  const uniqRes = await pool.query(`
    SELECT conname, conrelid::regclass, contype
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND contype = 'u';
  `);
  console.log(`Found ${uniqRes.rows.length} unique constraints:`);
  uniqRes.rows.forEach((c) => {
    console.log(`- [${c.conrelid}] ${c.conname}`);
  });

  console.log("\nDatabase hardening & index setup complete.");
  await pool.end();
}

run().catch((err) => {
  console.error("Index setup failed:", err);
  process.exit(1);
});
