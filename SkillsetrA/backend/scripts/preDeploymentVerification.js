require('dotenv').config();
const http = require('http');
const pool = require('../src/config/db');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

let server;
let baseUrl;
let adminToken;
let studentToken;
let studentId;
let sampleQuestionId;
let sampleAssessmentId;
let sampleAssignmentId;

async function setup() {
  const adminRes = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1");
  const admin = adminRes.rows[0];
  adminToken = jwt.sign(
    { userId: admin.id, username: admin.username, role: admin.role },
    process.env.JWT_SECRET || 'skillsetra_super_secret_key_change_this_later',
    { expiresIn: '2h' }
  );

  const studentRes = await pool.query(`
    SELECT s.id as student_id, u.id as user_id, u.username, s.full_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    LIMIT 1
  `);
  const student = studentRes.rows[0];
  studentId = student.student_id;
  studentToken = jwt.sign(
    { userId: student.user_id, username: student.username, role: 'student', studentId: student.student_id },
    process.env.JWT_SECRET || 'skillsetra_super_secret_key_change_this_later',
    { expiresIn: '2h' }
  );

  // Fetch sample IDs for testing
  const qRes = await pool.query('SELECT id FROM questions LIMIT 1');
  if (qRes.rows.length > 0) sampleQuestionId = qRes.rows[0].id;

  const assRes = await pool.query('SELECT id FROM assessments LIMIT 1');
  if (assRes.rows.length > 0) sampleAssessmentId = assRes.rows[0].id;

  const asgRes = await pool.query('SELECT id FROM assessment_assignments LIMIT 1');
  if (asgRes.rows.length > 0) sampleAssignmentId = asgRes.rows[0].id;

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function runPreDeployChecks() {
  console.log('\n=============================================================');
  console.log('🛡️  SKILLSETRA PRE-DEPLOYMENT COMPREHENSIVE AUDIT');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`✅ PASS: ${name} ${extra ? `(${extra})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
      failed++;
    }
  }

  try {
    await setup();

    // 1. AUTHENTICATION & PROFILE APIS
    console.log('--- 1. Authentication & Profile Endpoints ---');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const meData = await meRes.json();
    assert('Admin /api/auth/me Profile Check', meRes.status === 200 && meData.data?.role === 'admin');

    const studentMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const studentMeData = await studentMeRes.json();
    assert('Student /api/auth/me Profile Check', studentMeRes.status === 200 && studentMeData.data?.role === 'student');

    // 2. STUDENT ROSTER & ACTIONS
    console.log('\n--- 2. Student Management Endpoints ---');
    const studentsRes = await fetch(`${baseUrl}/api/students`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const studentsData = await studentsRes.json();
    const studentList = studentsData.data?.students || studentsData.data || studentsData;
    assert('Get Candidate Roster (Pagination & List)', studentsRes.status === 200 && Array.isArray(studentList));

    // 3. QUESTION BANK & QUESTION QUALITY ENGINE
    console.log('\n--- 3. Question Bank & Quality Engine ---');
    const questionsRes = await fetch(`${baseUrl}/api/questions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Get Question Bank List', questionsRes.status === 200);

    const qqListRes = await fetch(`${baseUrl}/api/admin/intelligence/questions?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const qqListData = await qqListRes.json();
    assert('Question Quality Engine List Aggregation', qqListRes.status === 200 && qqListData.success === true);

    if (sampleQuestionId) {
      const qqDiagRes = await fetch(`${baseUrl}/api/admin/intelligence/questions/${sampleQuestionId}/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert('Question Quality Diagnostic Modal Endpoint', qqDiagRes.status === 200);
    }

    // 4. ASSESSMENT MANAGEMENT (STANDARD & ADAPTIVE)
    console.log('\n--- 4. Assessment Management Workflow ---');
    const assessmentsRes = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Get Assessments List', assessmentsRes.status === 200);

    const createAdaptiveRes = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: `Pre-Deploy Adaptive Verification ${Date.now()}`,
        duration_minutes: 20,
        assessment_mode: 'ADAPTIVE',
        starting_difficulty: 'MEDIUM',
        min_questions: 2,
        max_questions: 4
      })
    });
    const newAssData = await createAdaptiveRes.json();
    const newAssId = newAssData.data?.id || newAssData.id;
    assert('Create Adaptive Assessment Endpoint', createAdaptiveRes.status === 201 && Boolean(newAssId));

    // 5. ASSIGNMENTS & LIVE MONITORING
    console.log('\n--- 5. Assignments & Live Monitoring ---');
    const assignmentsRes = await fetch(`${baseUrl}/api/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Get Assignments List', assignmentsRes.status === 200);

    const liveMonitoringRes = await fetch(`${baseUrl}/api/admin/monitoring/live`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const liveData = await liveMonitoringRes.json();
    assert('Live Exam Monitoring Feed (Active sessions & 5000 Event Stream)', liveMonitoringRes.status === 200 && liveData.data?.summary !== undefined);

    // 6. PLACEMENT INTELLIGENCE (ALL 8 DEPARTMENTS & TRENDS)
    console.log('\n--- 6. Placement Intelligence Dashboard Endpoints ---');
    const overviewRes = await fetch(`${baseUrl}/api/admin/intelligence/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Placement Intelligence: Overview Metrics', overviewRes.status === 200);

    const deptsRes = await fetch(`${baseUrl}/api/admin/intelligence/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const deptsData = await deptsRes.json();
    assert('Placement Intelligence: 8 Official Departments Option', deptsRes.status === 200 && deptsData.data?.length === 8, `Count: ${deptsData.data?.length}`);

    const yearsRes = await fetch(`${baseUrl}/api/admin/intelligence/years`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Placement Intelligence: Academic Years Breakdown', yearsRes.status === 200);

    const trendsRes = await fetch(`${baseUrl}/api/admin/intelligence/trends`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Placement Intelligence: Historical Trends', trendsRes.status === 200);

    const skillsRes = await fetch(`${baseUrl}/api/admin/intelligence/student-skills?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Placement Intelligence: Student Skill Profiles', skillsRes.status === 200);

    // 7. RESULTS & REPORTS
    console.log('\n--- 7. Results & Reports Endpoints ---');
    const resultsRes = await fetch(`${baseUrl}/api/results`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Get Results List', resultsRes.status === 200);

    // 8. SKILL AI AGENT CHAT & HISTORY
    console.log('\n--- 8. Skill AI Agent Endpoints ---');
    const aiChatRes = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ message: 'List available assessments' })
    });
    assert('Skill AI Chat Copilot Endpoint', aiChatRes.status === 200);

    const aiHistoryRes = await fetch(`${baseUrl}/api/agent/history`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert('Skill AI Chat History Endpoint', aiHistoryRes.status === 200);

    // 9. SECURITY RBAC CHECKS
    console.log('\n--- 9. Security & Role-Based Access Control ---');
    const studentAccessDenied = await fetch(`${baseUrl}/api/admin/intelligence/overview`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert('Security: Student access to Admin Intelligence rejected with 403 Forbidden', studentAccessDenied.status === 403);

    const studentQQDenied = await fetch(`${baseUrl}/api/admin/intelligence/questions`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert('Security: Student access to Question Quality rejected with 403 Forbidden', studentQQDenied.status === 403);

  } catch (err) {
    console.error('Fatal Pre-Deploy Error:', err);
    failed++;
  } finally {
    if (server) server.close();
    console.log('\n=============================================================');
    console.log('📊 AUDIT SUMMARY');
    console.log('=============================================================');
    console.log(`TOTAL AUDIT CHECKS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('=============================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPreDeployChecks();
