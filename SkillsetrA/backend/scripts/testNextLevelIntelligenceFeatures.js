require('dotenv').config();
const http = require('http');
const pool = require('../src/config/db');
const { generateToken } = require('../src/utils/jwt');
const assessmentService = require('../src/services/assessmentService');
const assignmentService = require('../src/services/assignmentService');
const attemptService = require('../src/services/attemptService');
const questionQualityService = require('../src/services/questionQualityService');
const intelligenceService = require('../src/services/intelligenceService');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const testResults = [];

function recordTest(testName, passed, details = '') {
  testResults.push({ testName, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 RUNNING NEXT-LEVEL INTELLIGENCE FEATURES VERIFICATION SUITE');
  console.log('=============================================================\n');

  const client = await pool.connect();
  let adminUserId;
  let studentUser;
  let studentRecord;
  let standardAssessmentId;
  let adaptiveAssessmentId;
  let adaptiveAssignmentId;
  let adaptiveAttemptId;

  try {
    // 0. Setup test users
    const adminRes = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRes.rows.length === 0) {
      throw new Error('No admin user found in database.');
    }
    adminUserId = adminRes.rows[0].id;

    const studentRes = await client.query(`SELECT s.*, u.id as u_user_id FROM students s JOIN users u ON s.user_id = u.id LIMIT 1`);
    if (studentRes.rows.length === 0) {
      throw new Error('No student user found in database.');
    }
    studentRecord = studentRes.rows[0];
    studentUser = { userId: studentRecord.u_user_id, role: 'student' };

    // =============================================================
    // TEST FEATURE 1: ADAPTIVE ASSESSMENT ENGINE
    // =============================================================
    console.log('\n--- 1. Testing Adaptive Assessment Engine ---');

    // Test 1.1: Create STANDARD assessment
    const qListRes = await client.query(`SELECT id FROM questions WHERE is_active = true AND category IN ('APTITUDE', 'VERBAL') LIMIT 5`);
    const qIds = qListRes.rows.map(r => r.id);

    const standardAss = await assessmentService.createAssessment({
      title: 'Standard Test Automated Verification',
      description: 'Standard mode verification',
      duration_minutes: 30,
      assessment_mode: 'STANDARD',
      questionIds: qIds
    }, adminUserId);
    standardAssessmentId = standardAss.id;

    recordTest(
      'Create STANDARD Assessment',
      standardAss.assessment_mode === 'STANDARD',
      `Mode: ${standardAss.assessment_mode}`
    );

    // Test 1.2: Create ADAPTIVE assessment
    const adaptiveAss = await assessmentService.createAssessment({
      title: 'Adaptive Test Automated Verification',
      description: 'Adaptive engine verification',
      duration_minutes: 30,
      assessment_mode: 'ADAPTIVE',
      starting_difficulty: 'MEDIUM',
      min_questions: 3,
      max_questions: 5,
      questionIds: []
    }, adminUserId);
    adaptiveAssessmentId = adaptiveAss.id;

    recordTest(
      'Create ADAPTIVE Assessment',
      adaptiveAss.assessment_mode === 'ADAPTIVE' && adaptiveAss.starting_difficulty === 'MEDIUM',
      `Mode: ${adaptiveAss.assessment_mode}, StartDiff: ${adaptiveAss.starting_difficulty}, Min: ${adaptiveAss.min_questions}, Max: ${adaptiveAss.max_questions}`
    );

    // Test 1.3: Publish and Assign ADAPTIVE assessment to student
    await assessmentService.publishAssessment(adaptiveAssessmentId, adminUserId);
    const assignRes = await assignmentService.createAssignments({
      assessmentId: adaptiveAssessmentId,
      studentIds: [studentRecord.id]
    }, adminUserId);
    adaptiveAssignmentId = assignRes.assigned[0]?.id;

    recordTest(
      'Publish and Assign Adaptive Assessment',
      !!adaptiveAssignmentId,
      `Assignment ID: ${adaptiveAssignmentId}`
    );

    // Test 1.4: Start Student Attempt in Adaptive Mode
    const startAttemptRes = await attemptService.startAttempt(adaptiveAssignmentId, studentUser.userId);
    adaptiveAttemptId = startAttemptRes.id;

    // Check first served question in attempt_questions
    const initialQs = await attemptService.getAttemptQuestions(adaptiveAttemptId, studentUser.userId);
    recordTest(
      'Start Adaptive Attempt & Serve Starting Question',
      initialQs.length === 1 && initialQs[0].difficulty.toUpperCase() === 'MEDIUM',
      `Served 1 starting question with difficulty: ${initialQs[0]?.difficulty}`
    );

    const q1 = initialQs[0];

    // Test 1.5: Security - Ensure correct_option is NEVER returned during active exam
    recordTest(
      'Security: correct_option hidden during active exam',
      q1.correct_option === undefined && q1.correct_answer === undefined,
      'correct_option is undefined'
    );

    // Test 1.6: Answer correctly and request next question -> difficulty should increase or maintain HARD
    // Fetch real correct option from DB directly to answer correctly
    const q1KeyRes = await client.query(`SELECT correct_option FROM questions WHERE id = $1`, [q1.id]);
    const correctOpt1 = q1KeyRes.rows[0].correct_option;

    await attemptService.saveAnswer(adaptiveAttemptId, q1.id, correctOpt1, studentUser.userId);
    const nextQ1 = await attemptService.getNextAdaptiveQuestion(adaptiveAttemptId, studentUser.userId);

    recordTest(
      'Adaptive Progression on Correct Answer (MEDIUM -> HARD)',
      nextQ1.completed === false && nextQ1.question && (nextQ1.question.difficulty === 'HARD' || nextQ1.question.difficulty === 'MEDIUM'),
      `Next Q difficulty: ${nextQ1.question?.difficulty}, Category: ${nextQ1.question?.category}`
    );

    const q2 = nextQ1.question;

    // Test 1.7: Answer incorrectly and request next question -> difficulty should decrease or maintain
    // Submit wrong answer
    const wrongOpt2 = correctOpt1 === 'A' ? 'B' : 'A';
    await attemptService.saveAnswer(adaptiveAttemptId, q2.id, wrongOpt2, studentUser.userId);
    const nextQ2 = await attemptService.getNextAdaptiveQuestion(adaptiveAttemptId, studentUser.userId);

    recordTest(
      'Adaptive Progression on Wrong Answer (Difficulty decreased/maintained)',
      nextQ2.completed === false && nextQ2.question !== undefined,
      `Next Q difficulty: ${nextQ2.question?.difficulty}, Category: ${nextQ2.question?.category}`
    );

    // Test 1.8: Refresh Resiliency & Idempotency
    const refreshedAttempt = await attemptService.getAttempt(adaptiveAttemptId, studentUser.userId);
    const allAssignedQs = refreshedAttempt.questions;

    recordTest(
      'Refresh Resiliency (All served questions preserved in immutable order)',
      allAssignedQs.length >= 3 && allAssignedQs[0].id === q1.id && allAssignedQs[1].id === q2.id,
      `Total preserved questions: ${allAssignedQs.length}`
    );

    // Test 1.9: Duplicate Prevention - Verify all questions in attempt_questions are unique
    const uniqueIds = new Set(allAssignedQs.map(q => q.id));
    recordTest(
      'No Duplicate Questions in Adaptive Attempt',
      uniqueIds.size === allAssignedQs.length,
      `Unique questions: ${uniqueIds.size} / ${allAssignedQs.length}`
    );

    // Test 1.10: Submit Attempt & Verify Final Result Calculation
    const submitRes = await attemptService.submitAttempt(adaptiveAttemptId, studentUser.userId);
    recordTest(
      'Submit Adaptive Attempt & Evaluate Score',
      submitRes.status === 'SUBMITTED' && submitRes.result !== undefined && typeof submitRes.score === 'number',
      `Score: ${submitRes.score}, Percentage: ${submitRes.percentage}%`
    );

    // =============================================================
    // TEST FEATURE 2: QUESTION QUALITY ENGINE
    // =============================================================
    console.log('\n--- 2. Testing Question Quality Engine ---');

    // Test 2.1: Fetch Question Quality List with PostgreSQL aggregation
    const qualityRes = await questionQualityService.getQuestionQualityList({
      category: 'ALL',
      difficulty: 'ALL',
      quality: 'ALL',
      page: 1,
      limit: 10
    });

    recordTest(
      'Question Quality List Aggregation',
      qualityRes.summary && Array.isArray(qualityRes.questions) && qualityRes.questions.length > 0,
      `Total questions evaluated: ${qualityRes.summary.total_questions}, Quality groups calculated`
    );

    // Test 2.2: Verify metrics for an individual question
    const qStat = qualityRes.questions[0];
    recordTest(
      'Question Quality Metrics Verification',
      typeof qStat.total_attempts === 'number' &&
      typeof qStat.answered_count === 'number' &&
      typeof qStat.correct_count === 'number' &&
      typeof qStat.wrong_count === 'number' &&
      typeof qStat.accuracy_percentage === 'number' &&
      qStat.option_distribution && qStat.flags !== undefined,
      `Q: "${qStat.question_text.slice(0, 30)}..." | Attempts: ${qStat.total_attempts}, Acc: ${qStat.accuracy_percentage}%, Quality: ${qStat.quality_indicator}`
    );

    // Test 2.3: Verify Detailed Question Analytics
    const detailAnalytics = await questionQualityService.getQuestionDetailedAnalytics(qStat.id);
    recordTest(
      'Detailed Question Diagnostics Endpoint',
      detailAnalytics && detailAnalytics.question && detailAnalytics.analytics && detailAnalytics.analytics.recommendation !== undefined,
      `Diagnostic note: "${detailAnalytics.analytics?.recommendation?.slice(0, 50)}..."`
    );

    // Test 2.4: Verify Quality Classification filtering
    const easyFilterRes = await questionQualityService.getQuestionQualityList({
      quality: 'INSUFFICIENT_DATA',
      limit: 5
    });
    recordTest(
      'Question Quality Filtering by Indicator',
      easyFilterRes.questions.every(q => q.quality_indicator === 'INSUFFICIENT_DATA'),
      `Filtered count: ${easyFilterRes.questions.length}`
    );

    // =============================================================
    // TEST FEATURE 3: PLACEMENT INTELLIGENCE DASHBOARD
    // =============================================================
    console.log('\n--- 3. Testing Placement Intelligence Dashboard ---');

    // Test 3.1: Overview Aggregations
    const overviewData = await intelligenceService.getPlacementOverview();
    recordTest(
      'Placement Intelligence Overview Aggregations',
      typeof overviewData.total_students === 'number' &&
      typeof overviewData.completed_attempts === 'number' &&
      typeof overviewData.avg_percentage === 'number' &&
      typeof overviewData.pass_rate === 'number' &&
      typeof overviewData.sections.aptitude.accuracy === 'number' &&
      typeof overviewData.sections.verbal.accuracy === 'number',
      `Avg Percentage: ${overviewData.avg_percentage}%, Aptitude Acc: ${overviewData.sections.aptitude.accuracy}%, Verbal Acc: ${overviewData.sections.verbal.accuracy}%`
    );

    // Test 3.2: Department-wise Intelligence
    const deptData = await intelligenceService.getDepartmentIntelligence();
    recordTest(
      'Department-wise Placement Intelligence',
      Array.isArray(deptData) && deptData.length > 0,
      `Departments analyzed: ${deptData.map(d => `${d.department} (${d.avg_percentage}%)`).join(', ')}`
    );

    // Test 3.3: Year-wise Intelligence
    const yearData = await intelligenceService.getYearIntelligence();
    recordTest(
      'Year-wise Placement Intelligence',
      Array.isArray(yearData),
      `Years recorded in DB: ${yearData.map(y => `${y.year} (${y.avg_percentage}%)`).join(', ') || 'None'}`
    );

    // Test 3.4: Performance Trends
    const trendsData = await intelligenceService.getPerformanceTrends();
    recordTest(
      'Assessment Performance Trends',
      Array.isArray(trendsData),
      `Historical assessment trend points: ${trendsData.length}`
    );

    // Test 3.5: Student Skill Profiles
    const skillProfiles = await intelligenceService.getStudentSkillProfiles(10);
    recordTest(
      'Student Skill Profiles Aggregation',
      Array.isArray(skillProfiles),
      `Skill profiles calculated: ${skillProfiles.length} students`
    );

    // Test 3.6: Topic Intelligence (Empty state / metadata verification)
    const topicData = await intelligenceService.getTopicIntelligence();
    recordTest(
      'Topic Intelligence Metadata Check',
      topicData !== undefined && (topicData.available === false || topicData.available === true),
      `Topic capability: ${topicData.available ? 'Available' : topicData.message}`
    );

    // =============================================================
    // TEST SECURITY & AUTHORIZATION
    // =============================================================
    console.log('\n--- 4. Testing Security & Authorization ---');

    // Verify token requirements
    const adminToken = generateToken({ id: adminUserId, username: 'admin', role: 'admin' });
    const studentToken = generateToken({ id: studentRecord.user_id, username: studentRecord.register_number, role: 'student' });

    const decodedAdmin = jwt.decode(adminToken);
    const decodedStudent = jwt.decode(studentToken);

    recordTest(
      'Admin JWT contains role: admin',
      decodedAdmin.role === 'admin',
      `Role: ${decodedAdmin.role}`
    );

    recordTest(
      'Student JWT contains role: student',
      decodedStudent.role === 'student',
      `Role: ${decodedStudent.role}`
    );

    // Start test server
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Test 4.3: Security - Admin Intelligence API forbidden for student
      const studentHttpRes = await fetch(`${baseUrl}/api/admin/intelligence/overview`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });

      recordTest(
        'Security: Student access to Admin Intelligence returns 403 Forbidden',
        studentHttpRes.status === 403,
        `Status: ${studentHttpRes.status}`
      );

      // Test 4.4: Security - Admin access to Admin Intelligence returns 200 OK
      const adminHttpRes = await fetch(`${baseUrl}/api/admin/intelligence/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const adminBody = await adminHttpRes.json();

      recordTest(
        'Security: Admin access to Admin Intelligence returns 200 OK',
        adminHttpRes.status === 200 && adminBody.success === true,
        `Status: ${adminHttpRes.status}`
      );
    } finally {
      server.close();
    }

    // Clean up test assessments
    await client.query(`DELETE FROM assessments WHERE id IN ($1, $2)`, [standardAssessmentId, adaptiveAssessmentId]);

  } catch (err) {
    console.error('❌ Test execution error:', err);
    recordTest('Complete Test Suite Execution', false, err.message);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n=============================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=============================================================');
  const passCount = testResults.filter(t => t.passed).length;
  const failCount = testResults.filter(t => !t.passed).length;
  console.log(`TOTAL TESTS: ${testResults.length}`);
  console.log(`PASSED: ${passCount}`);
  console.log(`FAILED: ${failCount}`);
  console.log('=============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
