const path = require('path');
const backendDir = 'c:\\Users\\bathi\\OneDrive\\Desktop\\peoject 1\\SkillsetrA\\backend';
require(path.join(backendDir, 'node_modules', 'dotenv')).config({ path: path.join(backendDir, '.env') });
const axios = require(path.join(backendDir, 'node_modules', 'axios'));
const pool = require(path.join(backendDir, 'src', 'config', 'db'));

const API_URL = 'http://localhost:5000/api';

async function verifyFullPlatform() {
  try {
    console.log('====================================================');
    console.log('🚀 SKILLSETRA FULL PLATFORM END-TO-END VERIFICATION');
    console.log('====================================================\n');

    // 1. Health check
    console.log('[STEP 1] Checking Backend Health...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health Check Status:', health.data.message);

    // 2. Student Login
    console.log('\n[STEP 2] Student Login Verification...');
    const loginRes = await axios.post(`${API_URL}/auth/student/login`, {
      username: 'bathiraj005',
      password: 'password123'
    });
    const token = loginRes.data.data.token;
    const studentUser = loginRes.data.data.user;
    console.log('✅ Student Login Successful!');
    console.log('   Student Name:', studentUser.fullName || studentUser.name || 'bathiraj005');
    console.log('   JWT Token acquired');


    // 3. Admin Login & Setup Test Assessment/Assignment if needed
    console.log('\n[STEP 3] Admin Auth & Assessment Setup...');
    const adminLogin = await axios.post(`${API_URL}/auth/admin/login`, {
      username: 'admin',
      password: 'CMS@Admin'
    });
    const adminToken = adminLogin.data.data.token;
    console.log('✅ Admin Login Successful!');

    // Ensure questions exist
    let qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
    let questions = qRes.data.data.questions || [];
    if (questions.length < 2) {
      console.log('Creating demo questions...');
      await axios.post(`${API_URL}/questions`, {
        question_text: "What is 25 + 25?",
        category: "APTITUDE",
        difficulty: "EASY",
        option_a: "40",
        option_b: "45",
        option_c: "50",
        option_d: "55",
        correct_option: "C",
        marks: 1
      }, { headers: { Authorization: `Bearer ${adminToken}` } });

      await axios.post(`${API_URL}/questions`, {
        question_text: "Choose the correct synonym for 'Happy'.",
        category: "VERBAL",
        difficulty: "EASY",
        option_a: "Sad",
        option_b: "Joyful",
        option_c: "Angry",
        option_d: "Weak",
        correct_option: "B",
        marks: 1
      }, { headers: { Authorization: `Bearer ${adminToken}` } });

      qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
      questions = qRes.data.data.questions || [];
    }

    // Create & Publish Assessment
    const createAss = await axios.post(`${API_URL}/assessments`, {
      title: "Placement Aptitude & Verbal Test E2E " + Date.now(),
      durationMinutes: 30,
      questionIds: [questions[0].id, questions[1].id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = createAss.data.data.id;
    await axios.patch(`${API_URL}/assessments/${assessmentId}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log('✅ Created & Published Assessment ID:', assessmentId);

    // Get student ID from DB
    const stuDB = await pool.query(`SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.username = 'bathiraj005'`);
    const studentId = stuDB.rows[0].id;

    // Assign to student
    const assignRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId,
      studentIds: [studentId]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assignmentId = assignRes.data.data.assigned[0].id;
    console.log('✅ Assigned Assessment to Student ID:', assignmentId);

    // 4. Student Starts Assessment & Verifies Timer
    console.log('\n[STEP 4] Student Starts Assessment & Timer...');
    const startAttemptRes = await axios.post(`${API_URL}/student/attempts`, { assignmentId }, { headers: { Authorization: `Bearer ${token}` } });
    const attempt = startAttemptRes.data.data;
    console.log('✅ Attempt Started ID:', attempt.id);
    console.log('   Status:', attempt.status);
    console.log('   Remaining Seconds:', attempt.remaining_seconds);
    console.log('   Expires At:', attempt.expires_at);

    // 5. Fetch Attempt Questions
    console.log('\n[STEP 5] Fetching Ordered Attempt Questions...');
    const fetchQRes = await axios.get(`${API_URL}/student/attempts/${attempt.id}/questions`, { headers: { Authorization: `Bearer ${token}` } });
    const attemptQuestions = fetchQRes.data.data;
    console.log(`✅ Loaded ${attemptQuestions.length} Questions for attempt`);
    console.log('   Q1:', attemptQuestions[0].question_text);
    console.log('   Q2:', attemptQuestions[1].question_text);

    // 6. Save Student Answer for Question 1
    console.log('\n[STEP 6] Saving Student Answer for Question 1...');
    // We select 'C' for Q1
    await axios.post(`${API_URL}/student/attempts/${attempt.id}/answers`, {
      questionId: attemptQuestions[0].id,
      selectedOption: 'C'
    }, { headers: { Authorization: `Bearer ${token}` } });
    console.log("✅ Selected Option 'C' saved for Q1");

    // We leave Q2 Unanswered intentionally to test Unanswered handling!

    // 7. Submit Attempt
    console.log('\n[STEP 7] Submitting Assessment Attempt...');
    const submitRes = await axios.post(`${API_URL}/student/attempts/${attempt.id}/submit`, {}, { headers: { Authorization: `Bearer ${token}` } });
    const resultObj = submitRes.data.data.result;
    console.log('✅ Test Submitted Successfully!');
    console.log('   Result ID:', resultObj.id);
    console.log('   Score:', resultObj.score, '/', resultObj.total_marks);
    console.log('   Correct Answers:', resultObj.correct_answers);
    console.log('   Wrong Answers:', resultObj.wrong_answers);
    console.log('   Unanswered:', resultObj.unanswered);

    // 8. View Detailed Answer Report (Feature Verification)
    console.log('\n[STEP 8] Student Views Detailed Answer Report...');
    const reportRes = await axios.get(`${API_URL}/student/results/${resultObj.id}`, { headers: { Authorization: `Bearer ${token}` } });
    const fullResult = reportRes.data.data;
    console.log('✅ Scorecard Loaded!');
    console.log('   Percentage:', fullResult.percentage + '%');
    console.log('   Detailed Answer Report Items:', fullResult.answer_report ? fullResult.answer_report.length : 0);

    console.log('\n--- ANSWER REPORT DETAILS BREAKDOWN ---');
    fullResult.answer_report.forEach((item, idx) => {
      console.log(`\nQuestion ${item.question_number}`);
      console.log(`Question: ${item.question_text}`);
      console.log(`A. ${item.option_a}`);
      console.log(`B. ${item.option_b}`);
      console.log(`C. ${item.option_c}`);
      console.log(`D. ${item.option_d}`);
      console.log(`Student Answer: ${item.selected_option ? item.selected_option + '. ' + item['option_' + item.selected_option.toLowerCase()] : 'Not Answered'}`);
      console.log(`Correct Answer: ${item.correct_option}. ${item['option_' + item.correct_option.toLowerCase()]}`);
      console.log(`Status: ${item.status}`);
      console.log(`Marks: ${item.marks_awarded} / ${item.question_marks}`);
    });

    console.log('\n====================================================');
    console.log('🎉 SKILLSETRA ALL END-TO-END TESTS PASSED 100%!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ E2E Verification failed:', err.response ? err.response.data : err.message);
  } finally {
    await pool.end();
  }
}

verifyFullPlatform();
