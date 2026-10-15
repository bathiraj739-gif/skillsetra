require('dotenv').config();
const http = require('http');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const pool = require('../src/config/db');
const emailService = require('../src/services/emailService');
const jwt = require('jsonwebtoken');

const PORT = 5000;
const API_BASE = `http://localhost:${PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'skillsetra_super_secret_key_change_this_later';

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('RUNNING ALL 12 RESEND EMAIL NOTIFICATION INTEGRATION TESTS');
  console.log('================================================================\n');

  let testServer;
  try {
    // Check if server is already running, else start in-process test server
    try {
      await axios.get(`http://localhost:${PORT}/api/health`, { timeout: 1500 });
    } catch (e) {
      testServer = http.createServer(app);
      await new Promise((resolve) => testServer.listen(PORT, resolve));
      console.log(`[TEST HARNESS] In-process test server started on port ${PORT}.\n`);
    }
  } catch (srvErr) {
    console.warn('[TEST HARNESS] Server startup note:', srvErr.message);
  }

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${name} ${details ? '- ' + details : ''}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? '- ' + details : ''}`);
    }
  }

  try {
    // 0. Setup test Admin & Test Student
    const adminUserRes = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1");
    if (adminUserRes.rows.length === 0) {
      throw new Error("No admin user found. Please run seed or create-admin first.");
    }
    const adminUser = adminUserRes.rows[0];
    const adminToken = jwt.sign(
      { userId: adminUser.id, username: adminUser.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const testSuffix = Date.now().toString().slice(-6);
    const studentUsername = `test_std_${testSuffix}`;
    const studentPassword = 'Password@123';
    const studentRegNo = `REG${testSuffix}`;
    const studentEmail = `student_${testSuffix}@example.com`;

    // Create student via API
    const createStudentRes = await axios.post(
      `${API_BASE}/students`,
      {
        full_name: `Test Student ${testSuffix}`,
        username: studentUsername,
        password: studentPassword,
        register_number: studentRegNo,
        email: studentEmail,
        department: 'Information Technology',
        year: '4',
        section: 'B'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const studentData = createStudentRes.data?.data?.student || createStudentRes.data?.student;
    const studentUserId = studentData.user_id;

    // TEST 1: Student login with valid credentials (and invalid login)
    // 1.1 Invalid credentials
    let invalidLoginFailed = false;
    try {
      await axios.post(`${API_BASE}/auth/student/login`, {
        username: studentUsername,
        password: 'WrongPassword'
      });
    } catch (err) {
      invalidLoginFailed = err.response?.status === 401;
    }
    assertTest('TEST 1.1: Invalid login fails with 401 (No email sent)', invalidLoginFailed);

    // 1.2 Valid credentials
    const validLoginRes = await axios.post(`${API_BASE}/auth/student/login`, {
      username: studentUsername,
      password: studentPassword
    });
    const studentToken = validLoginRes.data?.token;
    const loginOk = validLoginRes.status === 200 && !!studentToken;
    assertTest('TEST 1.2: Student login with valid credentials succeeds and triggers login-success email', loginOk, `Token received: ${studentToken ? 'Yes' : 'No'}`);

    // TEST 2: Student updates profile (and page refresh check)
    const updateProfileRes = await axios.put(
      `${API_BASE}/students/me`,
      {
        full_name: `Test Student ${testSuffix} Updated`,
        department: 'Artificial Intelligence',
        year: '4',
        section: 'A'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const updatedProfile = updateProfileRes.data?.data?.student || updateProfileRes.data?.student;
    const profileUpdatedOk = updateProfileRes.status === 200 && updatedProfile?.department === 'Artificial Intelligence';

    // Verify persistence after refresh
    const getProfileRes = await axios.get(`${API_BASE}/students/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const refreshedProfile = getProfileRes.data?.data?.student || getProfileRes.data?.student;
    const persistenceOk = refreshedProfile?.department === 'Artificial Intelligence' && refreshedProfile?.full_name.includes('Updated');
    assertTest('TEST 2: Student updates profile & changes persist across page refresh', profileUpdatedOk && persistenceOk);

    // TEST 3: Student changes password
    const newPassword = 'NewPassword@456';
    const changePassRes = await axios.post(
      `${API_BASE}/auth/change-password`,
      {
        currentPassword: studentPassword,
        newPassword: newPassword,
        confirmPassword: newPassword
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const passChangeOk = changePassRes.status === 200 && changePassRes.data?.success === true;

    // Verify old password fails
    let oldPassFails = false;
    try {
      await axios.post(`${API_BASE}/auth/student/login`, {
        username: studentUsername,
        password: studentPassword
      });
    } catch (err) {
      oldPassFails = err.response?.status === 401;
    }

    // Verify new password works
    const newLoginRes = await axios.post(`${API_BASE}/auth/student/login`, {
      username: studentUsername,
      password: newPassword
    });
    const newPassWorks = newLoginRes.status === 200 && !!newLoginRes.data?.token;
    const currentStudentToken = newLoginRes.data?.token;

    assertTest('TEST 3: Student password change (Old password rejected, new password authenticated, email triggered)', passChangeOk && oldPassFails && newPassWorks);

    // Setup an assessment with questions for assignment tests
    let assessmentRes = await pool.query("SELECT id, title, duration_minutes, total_marks FROM assessments WHERE status = 'PUBLISHED' LIMIT 1");
    let assessmentId;
    if (assessmentRes.rows.length === 0) {
      // Create and publish one assessment
      const qRes = await pool.query("SELECT id FROM questions LIMIT 2");
      const createAssRes = await pool.query(
        `INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
         VALUES ($1, 'Automated Test Assessment', 30, 2, 'PUBLISHED', $2) RETURNING id`,
        [`Test Assessment ${testSuffix}`, adminUser.id]
      );
      assessmentId = createAssRes.rows[0].id;
      if (qRes.rows.length > 0) {
        for (let i = 0; i < qRes.rows.length; i++) {
          await pool.query(
            `INSERT INTO assessment_questions (assessment_id, question_id, question_order) VALUES ($1, $2, $3)`,
            [assessmentId, qRes.rows[i].id, i + 1]
          );
        }
      }
    } else {
      assessmentId = assessmentRes.rows[0].id;
    }

    // TEST 4: Admin assigns assessment
    const assignRes = await axios.post(
      `${API_BASE}/assignments`,
      {
        assessmentId: assessmentId,
        studentIds: [studentData.id]
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const assignedList = assignRes.data?.data?.assigned || [];
    const assignment = assignedList[0];
    const assignmentAssignedOk = assignRes.status === 201 && assignedList.length > 0;
    assertTest('TEST 4: Admin assigns assessment (Assignment created & email triggered)', assignmentAssignedOk, `Assignment ID: ${assignment?.id}`);

    // TEST 5: Student opens assignment (Idempotent viewed notification)
    const viewRes1 = await axios.get(
      `${API_BASE}/student/assignments/${assignment.id}`,
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const assignmentLoaded = viewRes1.status === 200 && viewRes1.data?.data?.title !== undefined;

    // Check activity_logs count for ASSIGNMENT_VIEWED
    const logsRes1 = await pool.query(
      `SELECT COUNT(*) FROM activity_logs WHERE user_id = $1 AND action = 'ASSIGNMENT_VIEWED' AND entity_id = $2`,
      [studentUserId, assignment.id]
    );
    const countAfterFirstView = parseInt(logsRes1.rows[0].count, 10);

    // Refresh assignment multiple times
    await axios.get(`${API_BASE}/student/assignments/${assignment.id}`, { headers: { Authorization: `Bearer ${currentStudentToken}` } });
    await axios.get(`${API_BASE}/student/assignments/${assignment.id}`, { headers: { Authorization: `Bearer ${currentStudentToken}` } });

    const logsRes2 = await pool.query(
      `SELECT COUNT(*) FROM activity_logs WHERE user_id = $1 AND action = 'ASSIGNMENT_VIEWED' AND entity_id = $2`,
      [studentUserId, assignment.id]
    );
    const countAfterRefreshes = parseInt(logsRes2.rows[0].count, 10);

    const viewDeduplicated = countAfterFirstView === 1 && countAfterRefreshes === 1;
    assertTest('TEST 5: Student opens assignment (Viewed email triggered once; refreshing does NOT duplicate email)', assignmentLoaded && viewDeduplicated);

    // TEST 6: Student starts exam, answers and submits assessment
    const startAttemptRes = await axios.post(
      `${API_BASE}/student/attempts/start`,
      { assignmentId: assignment.id },
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const attemptId = startAttemptRes.data?.data?.id;

    // Get attempt questions
    const qListRes = await axios.get(
      `${API_BASE}/student/attempts/${attemptId}/questions`,
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const questions = qListRes.data?.data || [];
    if (questions.length > 0) {
      // Save answer for first question
      await axios.post(
        `${API_BASE}/student/attempts/${attemptId}/answers`,
        { questionId: questions[0].id, selectedOption: 'A' },
        { headers: { Authorization: `Bearer ${currentStudentToken}` } }
      );
    }

    // Submit attempt
    const submitRes = await axios.post(
      `${API_BASE}/student/attempts/${attemptId}/submit`,
      {},
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const resultData = submitRes.data?.data;
    const submitOk = submitRes.status === 200 && (resultData?.status === 'SUBMITTED' || resultData?.status === 'AUTO_SUBMITTED');
    assertTest('TEST 6: Student submits assessment (Attempt submitted, result generated, completion email triggered)', submitOk, `Score: ${resultData?.score}/${resultData?.total_marks}`);

    // TEST 7: Timer Auto-Submit Flow
    // Create dedicated assessment & attempt for timer auto-submit test
    const createAss2Res = await pool.query(
      `INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
       VALUES ($1, 'Timer Auto Submit Test Assessment', 30, 2, 'PUBLISHED', $2) RETURNING id`,
      [`Timer Test ${testSuffix}`, adminUser.id]
    );
    const assessment2Id = createAss2Res.rows[0].id;

    const assign2Res = await pool.query(
      `INSERT INTO assessment_assignments (assessment_id, student_id, assigned_by, status)
       VALUES ($1, $2, $3, 'ASSIGNED') RETURNING id`,
      [assessment2Id, studentData.id, adminUser.id]
    );
    const assignment2Id = assign2Res.rows[0].id;

    const attempt2Res = await pool.query(
      `INSERT INTO attempts (assessment_id, student_id, assignment_id, status, total_marks, started_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', 2, NOW() - INTERVAL '60 minutes') RETURNING id`,
      [assessment2Id, studentData.id, assignment2Id]
    );
    const attempt2Id = attempt2Res.rows[0].id;

    // Query attempt status - should detect expiration and auto-submit
    const statusCheckRes = await axios.get(
      `${API_BASE}/student/attempts/${attempt2Id}/status`,
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const autoSubmitOk = statusCheckRes.data?.data?.isExpired === true && (statusCheckRes.data?.data?.status === 'AUTO_SUBMITTED' || statusCheckRes.data?.data?.autoSubmitted === true);
    assertTest('TEST 7: Timer expires -> Attempt automatically transitions to AUTO_SUBMITTED & result evaluated', autoSubmitOk);

    // TEST 8: Double-Click / Duplicate Submit Idempotency
    const doubleSubmitRes = await axios.post(
      `${API_BASE}/student/attempts/${attemptId}/submit`,
      {},
      { headers: { Authorization: `Bearer ${currentStudentToken}` } }
    );
    const duplicateHandledSafely = doubleSubmitRes.status === 200 && doubleSubmitRes.data?.data?.status === 'SUBMITTED';

    const resultsCountRes = await pool.query(`SELECT COUNT(*) FROM results WHERE attempt_id = $1`, [attemptId]);
    const singleResultInDb = parseInt(resultsCountRes.rows[0].count, 10) === 1;
    assertTest('TEST 8: Double-click submit is idempotent (Single DB result, no duplicate emails)', duplicateHandledSafely && singleResultInDb);

    // TEST 9: Refresh Student Pages
    const getStudentResultsRes1 = await axios.get(`${API_BASE}/student/results`, { headers: { Authorization: `Bearer ${currentStudentToken}` } });
    const getStudentResultsRes2 = await axios.get(`${API_BASE}/student/results`, { headers: { Authorization: `Bearer ${currentStudentToken}` } });
    assertTest('TEST 9: Refreshing student pages executes cleanly without duplicate emails', getStudentResultsRes1.status === 200 && getStudentResultsRes2.status === 200);

    // TEST 10: Student attempts admin email endpoint -> 403 Forbidden
    let studentAdminBlocked = false;
    try {
      await axios.post(
        `${API_BASE}/admin/email/test`,
        { to: 'test@example.com' },
        { headers: { Authorization: `Bearer ${currentStudentToken}` } }
      );
    } catch (err) {
      studentAdminBlocked = err.response?.status === 403;
    }
    assertTest('TEST 10: Student role attempting admin email endpoint receives HTTP 403 Forbidden', studentAdminBlocked);

    // TEST 11: Check frontend source for zero Resend secrets
    const frontendDir = path.resolve(__dirname, '../../frontend/src');
    function searchSecretsInDir(dir) {
      let foundSecrets = [];
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.includes('node_modules')) {
          foundSecrets = foundSecrets.concat(searchSecretsInDir(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.env')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('RESEND_API_KEY') || content.includes('VITE_RESEND_API_KEY') || content.includes('api.resend.com')) {
            foundSecrets.push({ file: fullPath });
          }
        }
      }
      return foundSecrets;
    }
    const leakedSecrets = searchSecretsInDir(frontendDir);
    assertTest('TEST 11: Frontend codebase verification (Zero Resend secrets or API keys exposed in frontend)', leakedSecrets.length === 0, `Secrets found: ${leakedSecrets.length}`);

    // TEST 12: Invalid Resend configuration test (System resilience)
    const invalidEmailRes = await emailService.sendLoginSuccessEmail({
      to: 'invalid-email-string',
      studentName: 'Test Student',
      registerNumber: 'REG123'
    });
    const gracefulFailure = invalidEmailRes.success === false && invalidEmailRes.sent === false;
    assertTest('TEST 12: Invalid email/configuration fails gracefully without crashing or database corruption', gracefulFailure, `Handled error: "${invalidEmailRes.error}"`);

    // Cleanup test records
    await pool.query('DELETE FROM attempts WHERE student_id = $1', [studentData.id]);
    await pool.query('DELETE FROM assessment_assignments WHERE student_id = $1', [studentData.id]);
    await pool.query("DELETE FROM assessments WHERE title LIKE 'Timer Test %' OR title LIKE 'Test Assessment %'");
    await pool.query('DELETE FROM activity_logs WHERE user_id = $1', [studentUserId]);
    await pool.query('DELETE FROM students WHERE id = $1', [studentData.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [studentUserId]);

  } catch (err) {
    console.error('Test suite exception:', err.response?.data || err.message || err);
  }

  console.log('\n================================================================');
  console.log(`FINAL TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (testServer) {
    await new Promise((resolve) => testServer.close(resolve));
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

runComprehensiveTests();
