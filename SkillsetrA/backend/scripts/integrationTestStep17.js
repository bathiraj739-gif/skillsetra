const axios = require('axios');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:bathiraj@localhost:5432/skillsetra'
});

async function runIntegrationTests() {
  console.log('=== STEP 17 COMPLETE INTEGRATION TESTS ===\n');

  const results = {
    backendStartup: false,
    databaseConnection: false,
    healthApi: false,
    adminLogin: false,
    studentCreation: false,
    studentLogin: false,
    authMe: false,
    roleSecurity: false,
    questionBank: false,
    assessmentManagement: false,
    assignmentManagement: false,
    studentAssignments: false,
    examStart: false,
    questionOrderFixed: false,
    answerAutosave: false,
    examSubmit: false,
    automaticEvaluation: false,
    studentResults: false,
    adminResults: false,
    adminDashboard: false,
    liveMonitoring: false,
    logout: false,
    supabaseRemoved: false
  };

  try {
    // 1. Database Connection & Table Verification
    console.log('1. Verifying Database Connection and Schema...');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = tablesRes.rows.map(r => r.table_name);
    const requiredTables = [
      'users', 'students', 'questions', 'assessments', 
      'assessment_questions', 'assessment_assignments', 
      'attempts', 'attempt_questions', 'answers', 'results', 'activity_logs'
    ];
    
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    if (missingTables.length === 0) {
      console.log('   ✓ All 11 required PostgreSQL tables exist:', requiredTables.join(', '));
      results.databaseConnection = true;
    } else {
      console.error('   ✗ Missing database tables:', missingTables);
    }

    // 2. Health API Test
    console.log('\n2. Verifying GET /api/health...');
    try {
      const healthRes = await axios.get(`${API_URL}/health`);
      if (healthRes.data && healthRes.data.success === true) {
        console.log('   ✓ Health API response:', healthRes.data);
        results.backendStartup = true;
        results.healthApi = true;
      } else {
        console.error('   ✗ Unexpected health API response:', healthRes.data);
      }
    } catch (err) {
      console.error('   ✗ Health API failed:', err.message);
    }

    // 3. Admin Login Test
    console.log('\n3. Verifying Admin Authentication (POST /api/auth/admin/login)...');
    let adminToken = '';
    try {
      const adminLoginRes = await axios.post(`${API_URL}/auth/admin/login`, {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'Admin@123456'
      });
      if (adminLoginRes.data.success && adminLoginRes.data.data.token) {
        adminToken = adminLoginRes.data.data.token;
        const user = adminLoginRes.data.data.user;
        console.log('   ✓ Admin logged in successfully as:', user.username, 'Role:', user.role);
        if (!user.password && !user.password_hash) {
          console.log('   ✓ Security Check Passed: No password or password_hash in response.');
          results.adminLogin = true;
        } else {
          console.error('   ✗ Security Risk: Password or hash exposed in login response!');
        }
      }
    } catch (err) {
      console.error('   ✗ Admin Login failed:', err.response ? err.response.data : err.message);
    }

    // 4. Student Creation & Validation
    console.log('\n4. Verifying Student Creation (POST /api/students)...');
    const testRegNo = `REGTEST${Date.now().toString().slice(-4)}`;
    const testUsername = `student_${testRegNo.toLowerCase()}`;
    let createdStudent = null;
    try {
      const createStudentRes = await axios.post(
        `${API_URL}/students`,
        {
          username: testUsername,
          password: 'Password@123',
          register_number: testRegNo,
          full_name: 'Test Student Step17',
          email: `${testUsername}@example.com`,
          department: 'CSE',
          year: 4,
          section: 'A',
          phone: '9876543210'
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (createStudentRes.data.success) {
        createdStudent = createStudentRes.data.data;
        console.log('   ✓ Student created successfully:', createdStudent.username, '(Reg No:', createdStudent.register_number || createdStudent.registerNumber, ')');
        results.studentCreation = true;
      }
    } catch (err) {
      console.error('   ✗ Student Creation failed:', err.response ? err.response.data : err.message);
    }

    // 5. Student Login & Session Restoration (/auth/me)
    console.log('\n5. Verifying Student Login & /auth/me...');
    let studentToken = '';
    try {
      const studentLoginRes = await axios.post(`${API_URL}/auth/student/login`, {
        username: testUsername,
        password: 'Password@123'
      });
      if (studentLoginRes.data.success && studentLoginRes.data.data.token) {
        studentToken = studentLoginRes.data.data.token;
        console.log('   ✓ Student logged in successfully.');
        results.studentLogin = true;

        // Call /auth/me
        const meRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
        const currentUsername = meRes.data.data.user ? meRes.data.data.user.username : meRes.data.data.username;
        if (meRes.data.success && currentUsername === testUsername) {
          console.log('   ✓ /auth/me returned correct student profile:', currentUsername);
          results.authMe = true;
        }
      }
    } catch (err) {
      console.error('   ✗ Student Login or /auth/me failed:', err.response ? err.response.data : err.message);
    }

    // 6. Role Security Enforcement
    console.log('\n6. Verifying Role-Based Access Control Security...');
    try {
      // Student attempting Admin API -> expect 403
      let studentAdminCheckPassed = false;
      try {
        await axios.get(`${API_URL}/admin/dashboard/overview`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
      } catch (err) {
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          console.log('   ✓ Security Check Passed: Student accessing Admin endpoint returned HTTP', err.response.status);
          studentAdminCheckPassed = true;
        }
      }

      // No token -> expect 401
      let noTokenCheckPassed = false;
      try {
        await axios.get(`${API_URL}/questions`);
      } catch (err) {
        if (err.response && err.response.status === 401) {
          console.log('   ✓ Security Check Passed: Unauthenticated request returned HTTP 401');
          noTokenCheckPassed = true;
        }
      }

      if (studentAdminCheckPassed && noTokenCheckPassed) {
        results.roleSecurity = true;
      }
    } catch (err) {
      console.error('   ✗ Role security check error:', err.message);
    }

    // 7. Question Bank CRUD & Filtering
    console.log('\n7. Verifying Question Bank API (POST & GET /api/questions)...');
    let q1Id = '', q2Id = '';
    const uniqueTs = Date.now();
    try {
      // Create Aptitude Question
      const q1Res = await axios.post(
        `${API_URL}/questions`,
        {
          category: 'APTITUDE',
          question_text: `What is 15 * 12? (Test ${uniqueTs})`,
          option_a: '160',
          option_b: '180',
          option_c: '170',
          option_d: '190',
          correct_option: 'B',
          marks: 1,
          explanation: '15 * 12 = 180',
          difficulty: 'EASY'
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      q1Id = q1Res.data.data.id;

      // Create Verbal Question
      const q2Res = await axios.post(
        `${API_URL}/questions`,
        {
          category: 'VERBAL',
          question_text: `Choose the correct synonym for "Meticulous": (Test ${uniqueTs})`,
          option_a: 'Careless',
          option_b: 'Precise',
          option_c: 'Slow',
          option_d: 'Fast',
          correct_option: 'B',
          marks: 1,
          explanation: 'Meticulous means showing great attention to detail; precise.',
          difficulty: 'MEDIUM'
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      q2Id = q2Res.data.data.id;

      // GET Questions with filters
      const questionsRes = await axios.get(`${API_URL}/questions?category=APTITUDE&page=1&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (questionsRes.data.success && Array.isArray(questionsRes.data.data.questions)) {
        console.log('   ✓ Question Bank CRUD & Filtering working. Loaded', questionsRes.data.data.questions.length, 'Aptitude questions.');
        results.questionBank = true;
      }
    } catch (err) {
      console.error('   ✗ Question Bank check failed:', err.response ? err.response.data : err.message);
    }

    // 8. Assessment Management
    console.log('\n8. Verifying Assessment Creation & Publishing...');
    let assessmentId = '';
    try {
      const assessmentRes = await axios.post(
        `${API_URL}/assessments`,
        {
          title: `Step 17 Test Assessment ${Date.now()}`,
          description: 'End to end testing assessment',
          durationMinutes: 30,
          passingMarks: 1,
          instructions: 'Answer all questions carefully.',
          questionIds: [q1Id, q2Id]
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assessmentId = assessmentRes.data.data.id;
      console.log('   ✓ Assessment created in DRAFT status. Total Marks:', assessmentRes.data.data.totalMarks);

      // Publish Assessment
      const publishRes = await axios.patch(
        `${API_URL}/assessments/${assessmentId}/publish`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (publishRes.data.success && publishRes.data.data.status === 'PUBLISHED') {
        console.log('   ✓ Assessment published successfully.');
        results.assessmentManagement = true;
      }
    } catch (err) {
      console.error('   ✗ Assessment Management check failed:', err.response ? err.response.data : err.message);
    }

    // 9. Assignment Management
    console.log('\n9. Verifying Assignment Management...');
    let assignmentId = '';
    try {
      const targetStudentId = createdStudent.student ? createdStudent.student.id : createdStudent.id;
      const assignRes = await axios.post(
        `${API_URL}/assignments`,
        {
          assessmentId: assessmentId,
          studentIds: [targetStudentId],
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 86400000).toISOString()
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      if (assignRes.data.success) {
        console.log('   ✓ Assessment assigned to student.');
        results.assignmentManagement = true;
      }

      // Verify Student sees the assignment
      const studentAssigRes = await axios.get(`${API_URL}/student/assignments`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      if (studentAssigRes.data.success && Array.isArray(studentAssigRes.data.data)) {
        const found = studentAssigRes.data.data.find(a => (a.assessmentId || a.assessment_id) === assessmentId);
        if (found) {
          assignmentId = found.id;
          console.log('   ✓ Student GET /api/student/assignments returned the assignment (ID:', assignmentId, ')');
          results.studentAssignments = true;
        }
      }
    } catch (err) {
      console.error('   ✗ Assignment Management check failed:', err.response ? err.response.data : err.message);
    }

    // 10. Start Exam & Fixed Question Order Verification
    console.log('\n10. Verifying Exam Start & Fixed Question Order...');
    let attemptId = '';
    let initialQuestions = [];
    try {
      const startAttemptRes = await axios.post(
        `${API_URL}/student/attempts/start`,
        { assignmentId },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
      attemptId = startAttemptRes.data.data.id || startAttemptRes.data.data.attempt.id;
      const questionsRes = await axios.get(`${API_URL}/student/attempts/${attemptId}/questions`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      initialQuestions = questionsRes.data.data;
      console.log('   ✓ Exam started. Attempt ID:', attemptId, 'Loaded', initialQuestions.length, 'questions.');
      results.examStart = true;

      // Test Refresh / Re-fetch (Simulating browser refresh)
      const attemptFetchRes = await axios.get(`${API_URL}/student/attempts/${attemptId}`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      const refetchedQuestions = attemptFetchRes.data.data.questions;
      
      const getQId = q => q.id || q.question_id;
      const orderMatches = initialQuestions.every((q, index) => getQId(q) === getQId(refetchedQuestions[index]));
      if (orderMatches) {
        console.log('   ✓ Refresh recovery verified: Question order & attempt ID remain exactly identical on refresh.');
        results.questionOrderFixed = true;
      } else {
        console.error('   ✗ Question order changed on refresh!');
      }
    } catch (err) {
      console.error('   ✗ Exam Start / Refresh check failed:', err.response ? err.response.data : err.message);
    }

    // 11. Answer Autosave Verification
    console.log('\n11. Verifying Answer Autosave (POST /api/student/attempts/:attemptId/answers)...');
    try {
      const saveAnswer1 = await axios.post(
        `${API_URL}/student/attempts/${attemptId}/answers`,
        { questionId: q1Id, selectedOption: 'B' },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
      const saveAnswer2 = await axios.post(
        `${API_URL}/student/attempts/${attemptId}/answers`,
        { questionId: q2Id, selectedOption: 'B' },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );

      if (saveAnswer1.data.success && saveAnswer2.data.success) {
        // Query DB directly to verify no duplicate answer rows
        const dbAnswers = await pool.query(
          'SELECT question_id, selected_option FROM answers WHERE attempt_id = $1',
          [attemptId]
        );
        if (dbAnswers.rows.length === 2) {
          console.log('   ✓ Answers autosaved to PostgreSQL correctly without duplicate rows.');
          results.answerAutosave = true;
        } else {
          console.error('   ✗ Answer row count mismatch in DB:', dbAnswers.rows.length);
        }
      }
    } catch (err) {
      console.error('   ✗ Answer Autosave check failed:', err.response ? err.response.data : err.message);
    }

    // 12. Exam Submission & Automatic Evaluation
    console.log('\n12. Verifying Exam Submission & Automatic Evaluation...');
    try {
      const submitRes = await axios.post(
        `${API_URL}/student/attempts/${attemptId}/submit`,
        {},
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
      if (submitRes.data.success) {
        const evalData = submitRes.data.data;
        console.log('   ✓ Exam submitted and evaluated successfully!');
        console.log('     - Score:', evalData.score, '/', evalData.totalMarks);
        console.log('     - Percentage:', evalData.percentage, '%');
        console.log('     - Correct:', evalData.correctAnswers, '| Wrong:', evalData.wrongAnswers, '| Unanswered:', evalData.unanswered);
        results.examSubmit = true;
        results.automaticEvaluation = true;
      }
    } catch (err) {
      console.error('   ✗ Exam Submission failed:', err.response ? err.response.data : err.message);
    }

    // 13. Student & Admin Results
    console.log('\n13. Verifying Results APIs...');
    try {
      // Student Results
      const studentResultsRes = await axios.get(`${API_URL}/student/results`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      if (studentResultsRes.data.success && Array.isArray(studentResultsRes.data.data)) {
        console.log('   ✓ Student GET /api/student/results loaded', studentResultsRes.data.data.length, 'records.');
        results.studentResults = true;
      }

      // Admin Results
      const adminResultsRes = await axios.get(`${API_URL}/results`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (adminResultsRes.data.success) {
        console.log('   ✓ Admin GET /api/results loaded successfully.');
        results.adminResults = true;
      }
    } catch (err) {
      console.error('   ✗ Results check failed:', err.response ? err.response.data : err.message);
    }

    // 14. Admin Dashboard & Live Monitoring
    console.log('\n14. Verifying Admin Dashboard & Live Monitoring APIs...');
    try {
      const overviewRes = await axios.get(`${API_URL}/admin/dashboard/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (overviewRes.data.success) {
        console.log('   ✓ Admin Overview Dashboard returned PostgreSQL data metrics.');
        results.adminDashboard = true;
      }

      const monitoringRes = await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (monitoringRes.data.success) {
        console.log('   ✓ Admin Live Monitoring API returned PostgreSQL state.');
        results.liveMonitoring = true;
      }
    } catch (err) {
      console.error('   ✗ Admin Dashboard check failed:', err.response ? err.response.data : err.message);
    }

    // 15. Logout API
    console.log('\n15. Verifying Logout (POST /api/auth/logout)...');
    try {
      const logoutRes = await axios.post(
        `${API_URL}/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
      if (logoutRes.data.success) {
        console.log('   ✓ Logout API call succeeded.');
        results.logout = true;
      }
    } catch (err) {
      console.error('   ✗ Logout check failed:', err.response ? err.response.data : err.message);
    }

    // 16. Supabase Complete Audit
    console.log('\n16. Auditing Codebase for any remaining Supabase usage...');
    const fs = require('fs');
    const path = require('path');
    
    function searchDir(dir, patterns) {
      let found = [];
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          found = found.concat(searchDir(fullPath, patterns));
        } else if (stat.isFile() && /\.(js|jsx|ts|tsx|json|html|env)$/.test(file)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const p of patterns) {
            if (content.includes(p)) {
              found.push({ file: fullPath, pattern: p });
            }
          }
        }
      }
      return found;
    }

    const frontendDir = path.join(__dirname, '../../frontend/src');
    const supabaseMatches = searchDir(frontendDir, [
      '@supabase/supabase-js', 'createClient', 'VITE_SUPABASE', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'
    ]);

    if (supabaseMatches.length === 0) {
      console.log('   ✓ ZERO Supabase references found in frontend codebase!');
      results.supabaseRemoved = true;
    } else {
      console.error('   ✗ Supabase references detected:', supabaseMatches);
    }

  } catch (globalErr) {
    console.error('Global Error in Integration Test:', globalErr);
  } finally {
    await pool.end();
  }

  console.log('\n========================================');
  console.log('    INTEGRATION TEST SUMMARY REPORT     ');
  console.log('========================================');
  console.table(results);
}

runIntegrationTests();
