require("dotenv").config();
const axios = require("axios");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BASE_URL = process.env.API_URL || "http://localhost:5000/api";
const DEFAULT_PASSWORD = "Student@Password123";

// Helper for percentile calculation
function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

const { generateToken } = require("../src/utils/jwt");

async function setupTestEnvironment(studentCount) {
  console.log(`\n[SETUP] Preparing test environment for ${studentCount} students...`);
  const client = await pool.connect();
  try {
    // 1. Ensure test admin exists
    const adminPass = await bcrypt.hash("CMS@Admin", 10);
    const adminUserRes = await client.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ('admin', $1, 'admin', true)
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id;
    `, [adminPass]);
    const adminUserId = adminUserRes.rows[0].id;

    // 2. Create 10 test questions if not present
    const qIds = [];
    for (let i = 1; i <= 10; i++) {
      const qRes = await client.query(`
        INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, marks, category, difficulty, is_active)
        VALUES ($1, 'Option A', 'Option B', 'Option C', 'Option D', 'A', 1, 'APTITUDE', 'MEDIUM', true)
        ON CONFLICT DO NOTHING
        RETURNING id;
      `, [`Performance Test Question ${i} - What is 2 + ${i}?`]);

      if (qRes.rows.length > 0) {
        qIds.push(qRes.rows[0].id);
      }
    }

    const allQ = await client.query(`SELECT id FROM questions WHERE category = 'APTITUDE' LIMIT 10`);
    const finalQIds = allQ.rows.map(r => r.id);

    // 3. Create a benchmark assessment
    const assRes = await client.query(`
      INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
      VALUES ($1, 'Load Testing Assessment for Concurrency Verification', 60, 10, 'PUBLISHED', $2)
      RETURNING id;
    `, [`Benchmark Assessment ${Date.now()}`, adminUserId]);
    const assessmentId = assRes.rows[0].id;

    // Link questions to assessment
    for (let i = 0; i < finalQIds.length; i++) {
      await client.query(`
        INSERT INTO assessment_questions (assessment_id, question_id, question_order)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `, [assessmentId, finalQIds[i], i + 1]);
    }

    // 4. Batch create students & assignments
    console.log(`[SETUP] Creating ${studentCount} student records and assignments...`);
    const passHash = await bcrypt.hash(DEFAULT_PASSWORD, 8); // Fast salt for test setup
    const studentsData = [];

    const prefix = `perf_${Date.now() % 100000}`;
    for (let i = 1; i <= studentCount; i++) {
      const regNo = `${prefix}_${i}`;
      studentsData.push({ regNo, email: `${regNo}@test.com`, name: `Student ${i}` });
    }

    // Batch insert users
    const userValues = [];
    const userPlaceholders = studentsData.map((s, idx) => {
      const offset = idx * 4;
      userValues.push(s.regNo, passHash, 'student', true);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(', ');

    const uRes = await client.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ${userPlaceholders}
      RETURNING id, username, role;
    `, userValues);

    const userMap = new Map();
    uRes.rows.forEach(r => userMap.set(r.username, { id: r.id, token: generateToken({ id: r.id, username: r.username, role: 'student' }) }));

    // Batch insert students
    const stuValues = [];
    const stuPlaceholders = studentsData.map((s, idx) => {
      const offset = idx * 6;
      const uInfo = userMap.get(s.regNo);
      stuValues.push(uInfo.id, s.regNo, s.name, s.email, 'CSE', 3);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    }).join(', ');

    const sRes = await client.query(`
      INSERT INTO students (user_id, register_number, full_name, email, department, year)
      VALUES ${stuPlaceholders}
      RETURNING id, user_id, register_number;
    `, stuValues);

    // Batch insert assignments
    const asgValues = [];
    const asgPlaceholders = sRes.rows.map((s, idx) => {
      const offset = idx * 3;
      asgValues.push(assessmentId, s.id, 'ASSIGNED');
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const asgRes = await client.query(`
      INSERT INTO assessment_assignments (assessment_id, student_id, status)
      VALUES ${asgPlaceholders}
      RETURNING id, student_id;
    `, asgValues);

    const assignmentMap = new Map();
    asgRes.rows.forEach(r => assignmentMap.set(r.student_id, r.id));

    console.log(`✓ Setup complete: Assessment #${assessmentId}, ${sRes.rows.length} students & assignments ready.`);

    return {
      assessmentId,
      students: sRes.rows.map(r => {
        const uInfo = userMap.get(r.register_number);
        return {
          studentId: r.id,
          userId: r.user_id,
          registerNumber: r.register_number,
          assignmentId: assignmentMap.get(r.id),
          token: uInfo?.token
        };
      })
    };
  } finally {
    client.release();
  }
}

async function runStudentSim(studentInfo, metrics) {
  const http = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentInfo.token}`
    }
  });

  const recordReq = (duration, isSuccess, statusCode) => {
    metrics.totalRequests++;
    metrics.latencies.push(duration);
    if (isSuccess) {
      metrics.successRequests++;
    } else {
      metrics.failedRequests++;
      metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
    }
  };

  try {
    // 1. Fetch Assignments
    const t1 = Date.now();
    const asgRes = await http.get("/student/assignments");
    recordReq(Date.now() - t1, true, asgRes.status);

    // 2. Start Attempt
    const t2 = Date.now();
    const startRes = await http.post("/student/attempts/start", {
      assignmentId: studentInfo.assignmentId
    });
    recordReq(Date.now() - t2, true, startRes.status);
    const attemptId = startRes.data.data.id;

    // 3. Fetch Questions
    const t3 = Date.now();
    const qRes = await http.get(`/student/attempts/${attemptId}/questions`);
    recordReq(Date.now() - t3, true, qRes.status);
    const questions = qRes.data.data || [];

    // 4. Answer 5 questions concurrently (Autosave)
    const answerPromises = questions.slice(0, 5).map(async (q, idx) => {
      const opt = idx % 2 === 0 ? "A" : "B";
      const tAns = Date.now();
      try {
        const ansRes = await http.post(`/student/attempts/${attemptId}/answers`, {
          questionId: q.id,
          selectedOption: opt
        });
        recordReq(Date.now() - tAns, true, ansRes.status);
      } catch (err) {
        recordReq(Date.now() - tAns, false, err.response?.status || 500);
      }
    });
    await Promise.all(answerPromises);

    // 5. Check Status
    const t4 = Date.now();
    const statusRes = await http.get(`/student/attempts/${attemptId}/status`);
    recordReq(Date.now() - t4, true, statusRes.status);

    // 6. Submit Attempt
    const t5 = Date.now();
    const subRes = await http.post(`/student/attempts/${attemptId}/submit`);
    recordReq(Date.now() - t5, true, subRes.status);
    metrics.completedExams++;

    // 7. Test Idempotent Duplicate Submit (Simulate rapid double-click)
    const t6 = Date.now();
    const dupRes = await http.post(`/student/attempts/${attemptId}/submit`);
    recordReq(Date.now() - t6, true, dupRes.status);

    // 8. Fetch Result
    const t7 = Date.now();
    const resRes = await http.get(`/student/results/${attemptId}`);
    recordReq(Date.now() - t7, true, resRes.status);

  } catch (err) {
    const status = err.response?.status || 500;
    metrics.failedRequests++;
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;
  }
}

async function runConcurrencyTier(concurrency, totalStudents) {
  console.log(`\n==================================================`);
  console.log(`  LOAD TEST TIER: ${concurrency} CONCURRENT VIRTUAL USERS`);
  console.log(`==================================================`);

  const env = await setupTestEnvironment(totalStudents);

  const metrics = {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    completedExams: 0,
    statusCodes: {},
    latencies: []
  };

  const startTime = Date.now();
  console.log(`[EXECUTION] Launching ${totalStudents} users with batch size ${concurrency}...`);

  // Execute in batches of `concurrency`
  for (let i = 0; i < env.students.length; i += concurrency) {
    const batch = env.students.slice(i, i + concurrency);
    await Promise.all(batch.map(s => runStudentSim(s, metrics)));
  }

  const durationSec = (Date.now() - startTime) / 1000;
  const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / (metrics.latencies.length || 1);
  const p95Latency = getPercentile(metrics.latencies, 95);
  const p99Latency = getPercentile(metrics.latencies, 99);
  const minLatency = Math.min(...(metrics.latencies.length ? metrics.latencies : [0]));
  const maxLatency = Math.max(...(metrics.latencies.length ? metrics.latencies : [0]));
  const reqPerSec = (metrics.totalRequests / durationSec).toFixed(1);

  console.log(`\n--- RESULTS FOR ${concurrency} CONCURRENCY ---`);
  console.log(`- Total Duration: ${durationSec.toFixed(2)}s`);
  console.log(`- Total Requests: ${metrics.totalRequests}`);
  console.log(`- Throughput: ${reqPerSec} requests/sec`);
  console.log(`- Success Rate: ${((metrics.successRequests / (metrics.totalRequests || 1)) * 100).toFixed(2)}%`);
  console.log(`- Completed Exams: ${metrics.completedExams}/${totalStudents}`);
  console.log(`- Latency (Avg): ${avgLatency.toFixed(1)}ms`);
  console.log(`- Latency (p95): ${p95Latency}ms`);
  console.log(`- Latency (p99): ${p99Latency}ms`);
  console.log(`- Latency (Min / Max): ${minLatency}ms / ${maxLatency}ms`);
  console.log(`- Status Codes:`, JSON.stringify(metrics.statusCodes));

  return {
    concurrency,
    totalStudents,
    durationSec,
    totalRequests: metrics.totalRequests,
    successRequests: metrics.successRequests,
    failedRequests: metrics.failedRequests,
    reqPerSec,
    avgLatency: avgLatency.toFixed(1),
    p95Latency,
    p99Latency,
    minLatency,
    maxLatency,
    statusCodes: metrics.statusCodes
  };
}

async function main() {
  console.log("==================================================");
  console.log("   SKILLSETRA HIGH-CONCURRENCY LOAD TESTING       ");
  console.log("==================================================");

  const results = [];

  // Progressive load testing tiers
  results.push(await runConcurrencyTier(100, 100));
  results.push(await runConcurrencyTier(300, 300));
  results.push(await runConcurrencyTier(500, 500));
  results.push(await runConcurrencyTier(1000, 1000));
  results.push(await runConcurrencyTier(2000, 2000));

  console.log("\n==================================================");
  console.log("             SUMMARY OF ALL TIERS                 ");
  console.log("==================================================");
  console.table(results.map(r => ({
    "Concurrency": r.concurrency,
    "Users": r.totalStudents,
    "Requests": r.totalRequests,
    "Throughput (req/s)": r.reqPerSec,
    "Avg Latency": `${r.avgLatency}ms`,
    "p95 Latency": `${r.p95Latency}ms`,
    "p99 Latency": `${r.p99Latency}ms`,
    "Success Rate": `${((r.successRequests / r.totalRequests) * 100).toFixed(2)}%`
  })));

  await pool.end();
}

main().catch(err => {
  console.error("Load test failed:", err);
  process.exit(1);
});
