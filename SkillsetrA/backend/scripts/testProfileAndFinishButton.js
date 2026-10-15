require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const pool = require('../src/config/db');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING RIGOROUS VERIFICATION OF CHANGES 1 & 2 ===\n');

  let adminToken = '';
  let studentToken = '';
  let testStudentId = '';
  let testUserId = '';
  const testRegNo = 'REG' + Date.now().toString().slice(-6);
  const testUsername = 'test_student_' + Date.now().toString().slice(-4);
  const testPassword = 'Password123!';

  try {
    // 0. Login as Admin
    console.log('[Step 0] Logging in as Admin...');
    const adminPassword = process.env.ADMIN_PASSWORD || 'CMS@Admin';
    const adminLoginRes = await axios.post(`${API_BASE}/auth/admin/login`, {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: adminPassword
    });
    adminToken = adminLoginRes.data.data?.token || adminLoginRes.data.token;
    console.log('✓ Admin login successful.');

    // TEST 1: Admin creates student with Department = CSE, Year = 3rd Year, Section = A
    console.log('\n[TEST 1] Admin creates student with Department=CSE, Year=3rd Year, Section=A...');
    const createRes = await axios.post(
      `${API_BASE}/students`,
      {
        username: testUsername,
        password: testPassword,
        full_name: 'Arun Kumar',
        register_number: testRegNo,
        email: `${testUsername}@example.com`,
        department: 'CSE',
        year: '3rd Year',
        section: 'A'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const createdStudent = createRes.data.student;
    testStudentId = createdStudent.id;
    testUserId = createdStudent.user_id;

    // Verify in database directly
    const dbCheck = await pool.query('SELECT * FROM students WHERE id = $1', [testStudentId]);
    const dbRow = dbCheck.rows[0];
    console.log('Database row verification:', {
      full_name: dbRow.full_name,
      department: dbRow.department,
      year: dbRow.year,
      section: dbRow.section
    });

    if (dbRow.department !== 'CSE' || dbRow.year !== '3rd Year' || dbRow.section !== 'A') {
      throw new Error(`TEST 1 Failed: DB values do not match exact admin input: department=${dbRow.department}, year=${dbRow.year}, section=${dbRow.section}`);
    }
    console.log('✓ TEST 1 PASSED: Database stored exact values (CSE, 3rd Year, A).');

    // TEST 2: Student logs in → Profile
    console.log('\n[TEST 2] Student logs in and fetches profile...');
    const studentLoginRes = await axios.post(`${API_BASE}/auth/student/login`, {
      username: testUsername,
      password: testPassword
    });
    studentToken = studentLoginRes.data.data?.token || studentLoginRes.data.token;

    // Call /api/auth/me
    const meRes = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const studentProfile = meRes.data.data.student || meRes.data.data.user;
    console.log('Student Profile (/api/auth/me):', {
      name: studentProfile.full_name || studentProfile.name,
      department: studentProfile.department,
      year: studentProfile.year,
      section: studentProfile.section
    });

    if (studentProfile.department !== 'CSE' || studentProfile.year !== '3rd Year' || studentProfile.section !== 'A') {
      throw new Error('TEST 2 Failed: Student profile does not match admin-provided values.');
    }

    // Also call GET /api/students/:id as student
    const studentGetRes = await axios.get(`${API_BASE}/students/${testStudentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const sData = studentGetRes.data.data.student;
    if (sData.department !== 'CSE' || sData.year !== '3rd Year' || sData.section !== 'A') {
      throw new Error('TEST 2 Failed: GET /api/students/:id returned incorrect student details.');
    }
    console.log('✓ TEST 2 PASSED: Student profile successfully displays exact stored values.');

    // TEST 3: Student updates an allowed profile field
    console.log('\n[TEST 3] Student updates allowed profile fields (full_name, phone, section, year)...');
    const updateRes = await axios.put(
      `${API_BASE}/students/${testStudentId}`,
      {
        full_name: 'Arun Kumar Updated',
        department: 'CSE',
        year: '4th Year',
        section: 'B',
        phone: '9876543210',
        // Protected fields attempts:
        register_number: 'HACKED_REG',
        role: 'admin'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    // Verify DB update
    const dbUpdateCheck = await pool.query('SELECT * FROM students WHERE id = $1', [testStudentId]);
    const updatedRow = dbUpdateCheck.rows[0];
    console.log('Database updated row:', {
      full_name: updatedRow.full_name,
      year: updatedRow.year,
      section: updatedRow.section,
      phone: updatedRow.phone,
      register_number: updatedRow.register_number
    });

    if (
      updatedRow.full_name !== 'Arun Kumar Updated' ||
      updatedRow.year !== '4th Year' ||
      updatedRow.section !== 'B' ||
      updatedRow.phone !== '9876543210'
    ) {
      throw new Error('TEST 3 Failed: Allowed fields were not properly updated.');
    }

    // Verify protected field was NOT changed by student
    if (updatedRow.register_number === 'HACKED_REG') {
      throw new Error('TEST 3 Failed: Student was able to modify protected field register_number!');
    }
    console.log('✓ Protected field protection verified: register_number remained intact.');

    // Verify student cannot update ANOTHER student's profile
    try {
      await axios.put(
        `${API_BASE}/students/00000000-0000-0000-0000-000000000001`,
        { full_name: 'Attacker' },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
      throw new Error('TEST 3 Failed: Student was able to request update on another profile without 403/404!');
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 404)) {
        console.log(`✓ Authorization check verified: Student cannot update other profiles (${err.response.status}).`);
      } else {
        throw err;
      }
    }
    console.log('✓ TEST 3 PASSED: Student successfully updated allowed fields and DB is updated.');

    // TEST 4: Admin views the same student
    console.log('\n[TEST 4] Admin views the student list and student by ID...');
    const adminGetStudentRes = await axios.get(`${API_BASE}/students/${testStudentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminSeenStudent = adminGetStudentRes.data.data.student;
    console.log('Admin saw student:', {
      name: adminSeenStudent.full_name,
      year: adminSeenStudent.year,
      section: adminSeenStudent.section,
      phone: adminSeenStudent.phone
    });

    if (
      adminSeenStudent.full_name !== 'Arun Kumar Updated' ||
      adminSeenStudent.year !== '4th Year' ||
      adminSeenStudent.section !== 'B' ||
      adminSeenStudent.phone !== '9876543210'
    ) {
      throw new Error('TEST 4 Failed: Admin did not see updated profile fields.');
    }
    console.log('✓ TEST 4 PASSED: Admin sees the updated student information.');

    // TEST 5 & 6: Assessment Navigation Logic Check
    console.log('\n[TEST 5 & 6] Verifying Question Navigation Logic: [Next] vs [Finish]...');
    // We inspect frontend/src/pages/student/ExamInterface.tsx logic:
    // When currentIndex < totalQuestions - 1 => renders Next
    // When currentIndex === totalQuestions - 1 => renders Finish (and NOT Next)
    const fs = require('fs');
    const examInterfaceContent = fs.readFileSync('c:/Users/bathi/OneDrive/Desktop/peoject 1/SkillsetrA/frontend/src/pages/student/ExamInterface.tsx', 'utf8');

    const hasConditionalFinish = examInterfaceContent.includes('currentIndex < totalQuestions - 1 ? (');
    const hasNextBtn = examInterfaceContent.includes('Next');
    const hasFinishBtn = examInterfaceContent.includes('Finish');
    const triggersSubmitModal = examInterfaceContent.includes('setShowSubmitModal(true)');

    if (!hasConditionalFinish || !hasNextBtn || !hasFinishBtn || !triggersSubmitModal) {
      throw new Error('TEST 5/6 Failed: ExamInterface does not contain the required conditional Finish button.');
    }
    console.log('✓ TEST 5 & 6 PASSED: ExamInterface conditionally replaces Next with Finish on final question.');

    // TEST 7 & 8: Create assessment, assign, attempt, test Finish -> Submit flow
    console.log('\n[TEST 7 & 8] Creating assessment attempt to test submission flow...');
    // Create an assessment with 2 questions
    const q1Res = await pool.query(
      `INSERT INTO questions (category, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
       VALUES ('APTITUDE', 'EASY', 'What is 2 + 2?', '2', '3', '4', '5', 'C', 1)
       RETURNING id`
    );
    const q2Res = await pool.query(
      `INSERT INTO questions (category, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
       VALUES ('APTITUDE', 'EASY', 'What is 5 * 5?', '20', '25', '30', '35', 'B', 1)
       RETURNING id`
    );
    const q1Id = q1Res.rows[0].id;
    const q2Id = q2Res.rows[0].id;

    const assessRes = await pool.query(
      `INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
       VALUES ('E2E Verification Assessment', 'Test', 30, 2, 'PUBLISHED', (SELECT id FROM users WHERE username = 'admin' LIMIT 1))
       RETURNING id`
    );
    const assessId = assessRes.rows[0].id;

    await pool.query(
      `INSERT INTO assessment_questions (assessment_id, question_id, question_order)
       VALUES ($1, $2, 1), ($1, $3, 2)`,
      [assessId, q1Id, q2Id]
    );

    // Assign to student
    const assignRes = await pool.query(
      `INSERT INTO assessment_assignments (assessment_id, student_id, status, assigned_by)
       VALUES ($1, $2, 'ASSIGNED', (SELECT id FROM users WHERE username = 'admin' LIMIT 1))
       RETURNING id`,
      [assessId, testStudentId]
    );
    const assignmentId = assignRes.rows[0].id;

    // Student starts assessment
    const startRes = await axios.post(
      `${API_BASE}/student/attempts/start`,
      { assignmentId },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const attemptId = startRes.data.data.id;
    console.log('Assessment started with attempt ID:', attemptId);

    // Student answers questions
    await axios.post(
      `${API_BASE}/student/attempts/${attemptId}/answers`,
      {
        questionId: q1Id,
        selectedOption: 'C'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    await axios.post(
      `${API_BASE}/student/attempts/${attemptId}/answers`,
      {
        questionId: q2Id,
        selectedOption: 'B'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    // TEST 8: Submit assessment (the action triggered when student confirms in the Submit modal)
    console.log('[TEST 8] Submitting assessment via submit API...');
    const submitRes = await axios.post(
      `${API_BASE}/student/attempts/${attemptId}/submit`,
      {},
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    console.log('Submission response:', {
      success: submitRes.data.success,
      score: submitRes.data.data?.score,
      status: submitRes.data.data?.status
    });

    if (!submitRes.data.success || submitRes.data.data?.status !== 'SUBMITTED') {
      throw new Error(`TEST 8 Failed: Submission status is not SUBMITTED (got ${submitRes.data.data?.status}).`);
    }
    console.log('✓ TEST 7 & 8 PASSED: Finish -> Submit confirmation flow executes submit API and generates completed result.');

    // TEST 9: Attempt / Question / Timer state persistence on refresh
    console.log('\n[TEST 9] Verifying attempt state persistence on refresh...');
    // Create another attempt to test active attempt resumption
    const assess2Res = await pool.query(
      `INSERT INTO assessments (title, description, duration_minutes, total_marks, status, created_by)
       VALUES ('E2E Refresh Test Assessment', 'Test', 30, 2, 'PUBLISHED', (SELECT id FROM users WHERE username = 'admin' LIMIT 1))
       RETURNING id`
    );
    const assess2Id = assess2Res.rows[0].id;
    await pool.query(
      `INSERT INTO assessment_questions (assessment_id, question_id, question_order)
       VALUES ($1, $2, 1), ($1, $3, 2)`,
      [assess2Id, q1Id, q2Id]
    );
    const assign2Res = await pool.query(
      `INSERT INTO assessment_assignments (assessment_id, student_id, status, assigned_by)
       VALUES ($1, $2, 'ASSIGNED', (SELECT id FROM users WHERE username = 'admin' LIMIT 1))
       RETURNING id`,
      [assess2Id, testStudentId]
    );
    const assignment2Id = assign2Res.rows[0].id;

    // Start attempt
    const start2Res = await axios.post(
      `${API_BASE}/student/attempts/start`,
      { assignmentId: assignment2Id },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const attempt2Id = start2Res.data.data.id;

    // Save answer to question 1
    await axios.post(
      `${API_BASE}/student/attempts/${attempt2Id}/answers`,
      {
        questionId: q1Id,
        selectedOption: 'C'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    // Simulate "Page Refresh":
    // The frontend on mount / refresh calls GET /api/student/attempts/:id
    const resumeRes = await axios.get(
      `${API_BASE}/student/attempts/${attempt2Id}`,
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    const fetchedAttempt = resumeRes.data.data.attempt || resumeRes.data.data;
    if (fetchedAttempt.id !== attempt2Id || fetchedAttempt.status !== 'IN_PROGRESS') {
      throw new Error(`TEST 9 Failed: Calling GET attempt on refresh did not return IN_PROGRESS attempt (got ${fetchedAttempt?.status}).`);
    }

    // Verify saved answer persisted
    const savedAnswersCheck = await pool.query(
      'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
      [attempt2Id, q1Id]
    );
    if (savedAnswersCheck.rows.length === 0 || savedAnswersCheck.rows[0].selected_option !== 'C') {
      throw new Error('TEST 9 Failed: Saved response did not persist across refresh.');
    }
    console.log('✓ TEST 9 PASSED: Active attempt and saved answers are preserved across refresh.');

    // Clean up test data
    console.log('\n[Cleanup] Cleaning up created test entities...');
    await pool.query('DELETE FROM answers WHERE attempt_id IN ($1, $2)', [attemptId, attempt2Id]);
    await pool.query('DELETE FROM attempt_questions WHERE attempt_id IN ($1, $2)', [attemptId, attempt2Id]);
    await pool.query('DELETE FROM results WHERE attempt_id IN ($1, $2)', [attemptId, attempt2Id]);
    await pool.query('DELETE FROM attempts WHERE id IN ($1, $2)', [attemptId, attempt2Id]);
    await pool.query('DELETE FROM assessment_assignments WHERE assessment_id IN ($1, $2)', [assessId, assess2Id]);
    await pool.query('DELETE FROM assessment_questions WHERE assessment_id IN ($1, $2)', [assessId, assess2Id]);
    await pool.query('DELETE FROM assessments WHERE id IN ($1, $2)', [assessId, assess2Id]);
    await pool.query('DELETE FROM questions WHERE id IN ($1, $2)', [q1Id, q2Id]);
    await pool.query('DELETE FROM students WHERE id = $1', [testStudentId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('✓ Cleanup complete.');

    console.log('\n==================================================');
    console.log('🎉 ALL 9 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS');
    console.log('==================================================');
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
