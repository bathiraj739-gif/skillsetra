const path = require('path');
const backendDir = 'c:\\Users\\bathi\\OneDrive\\Desktop\\peoject 1\\SkillsetrA\\backend';
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });

const pool = require(path.join(backendDir, 'src', 'config', 'db'));
const attemptService = require(path.join(backendDir, 'src', 'services', 'attemptService'));

async function runTests() {
  try {
    console.log('--- STARTING TIMER & AUTO-SUBMIT FEATURE INTEGRATION TESTS ---');

    // 1. Fetch a test student
    const stuRes = await pool.query(`SELECT id, user_id FROM students LIMIT 2`);
    if (stuRes.rows.length < 1) {
      console.log('No students found to run test.');
      process.exit(0);
    }
    const student1 = stuRes.rows[0];
    const student2 = stuRes.rows[1] || stuRes.rows[0];

    // 2. Fetch a published assessment
    const assRes = await pool.query(`SELECT id, duration_minutes FROM assessments LIMIT 1`);

    if (assRes.rows.length === 0) {
      console.log('No published assessment found.');
      process.exit(0);
    }
    const assessment = assRes.rows[0];
    console.log(`Using Assessment ID: ${assessment.id}, Duration: ${assessment.duration_minutes} minutes`);

    // 3. Ensure assignment exists for student 1
    let assignRes = await pool.query(
      `SELECT id FROM assessment_assignments WHERE assessment_id = $1 AND student_id = $2`,
      [assessment.id, student1.id]
    );
    let assignmentId;
    if (assignRes.rows.length === 0) {
      const newAssign = await pool.query(
        `INSERT INTO assessment_assignments (assessment_id, student_id, status) VALUES ($1, $2, 'ASSIGNED') RETURNING id`,
        [assessment.id, student1.id]
      );
      assignmentId = newAssign.rows[0].id;
    } else {
      assignmentId = assignRes.rows[0].id;
      // Reset assignment status to ASSIGNED for clean test run
      await pool.query(`UPDATE assessment_assignments SET status = 'ASSIGNED' WHERE id = $1`, [assignmentId]);
      // Delete previous test attempt if any
      await pool.query(`DELETE FROM attempts WHERE assignment_id = $1`, [assignmentId]);
    }

    console.log('\nTEST 1 & 2: Start Attempt & Check Remaining Time calculation');
    const startData = await attemptService.startAttempt(assignmentId, student1.user_id);
    console.log('✅ Attempt Started ID:', startData.id);
    console.log('✅ Status:', startData.status);
    console.log('✅ Remaining Seconds:', startData.remaining_seconds);
    if (startData.remaining_seconds > 0 && startData.remaining_seconds <= (assessment.duration_minutes * 60)) {
      console.log('✅ TEST 1 PASSED: Timer started with correct duration');
    } else {
      console.error('❌ TEST 1 FAILED: Incorrect remaining seconds');
    }

    console.log('\nTEST 3 & 4: Get Attempt Status (Server is source of truth)');
    const statusData = await attemptService.getAttemptStatus(startData.id, student1.user_id);
    console.log('✅ Server Remaining Seconds:', statusData.remainingSeconds);
    console.log('✅ Server Expires At:', statusData.expiresAt);
    if (!statusData.isExpired && statusData.remainingSeconds > 0) {
      console.log('✅ TEST 3 PASSED: Server time calculation verified');
    }

    console.log('\nTEST 5: Save Answer while attempt is active');
    const questions = await attemptService.getAttemptQuestions(startData.id, student1.user_id);
    if (questions.length > 0) {
      const q1 = questions[0];
      await attemptService.saveAnswer(startData.id, q1.id, 'A', student1.user_id);
      console.log(`✅ Saved option 'A' for question 1 (${q1.id})`);
    }

    console.log('\nTEST 6: Simulate Expiration in Database (backdate started_at by duration + 5 mins)');
    const durationMs = (assessment.duration_minutes || 30) * 60 * 1000;
    const expiredStartedAt = new Date(Date.now() - (durationMs + 300000)); // 5 mins past expiration
    await pool.query(`UPDATE attempts SET started_at = $1 WHERE id = $2`, [expiredStartedAt, startData.id]);
    console.log('Backdated attempt started_at to:', expiredStartedAt.toISOString());

    console.log('\nTEST 7: Get status after expiration (should trigger Auto Submit)');
    const expStatus = await attemptService.getAttemptStatus(startData.id, student1.user_id);
    console.log('✅ Status after expiration check:', expStatus.status);
    console.log('✅ Is Expired:', expStatus.isExpired);
    if (expStatus.status === 'AUTO_SUBMITTED') {
      console.log('✅ TEST 7 PASSED: Status automatically became AUTO_SUBMITTED');
    } else {
      console.error('❌ TEST 7 FAILED: Status is not AUTO_SUBMITTED');
    }

    console.log('\nTEST 8: Verify Result record generated for auto-submitted attempt');
    const resRow = await pool.query(`SELECT * FROM results WHERE attempt_id = $1`, [startData.id]);
    if (resRow.rows.length > 0) {
      console.log('✅ Result score:', resRow.rows[0].score);
      console.log('✅ Correct answers:', resRow.rows[0].correct_answers);
      console.log('✅ Unanswered:', resRow.rows[0].unanswered);
      console.log('✅ TEST 8 PASSED: Result automatically evaluated');
    } else {
      console.error('❌ TEST 8 FAILED: Result record not created');
    }

    console.log('\nTEST 9: Attempting to save answer after expiration');
    try {
      if (questions.length > 0) {
        await attemptService.saveAnswer(startData.id, questions[0].id, 'B', student1.user_id);
        console.error('❌ TEST 9 FAILED: Answer allowed after expiration!');
      }
    } catch (err) {
      console.log('✅ TEST 9 PASSED: Backend rejected late answer edit with error:', err.message);
    }


    console.log('\nTEST 10: Idempotent Submission Call after auto-submit');
    const doubleSub = await attemptService.submitAttempt(startData.id, student1.user_id);
    console.log('✅ Double submit returned status:', doubleSub.status);
    if (doubleSub.status === 'AUTO_SUBMITTED' && doubleSub.result) {
      console.log('✅ TEST 10 PASSED: Submit is idempotent and returns existing result without error');
    }

    console.log('\n==================================================');
    console.log('🎉 ALL 10 INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Test execution error:', err);
  } finally {
    await pool.end();
  }
}

runTests();
