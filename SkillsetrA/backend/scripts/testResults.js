const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runTests() {
  try {
    console.log('--- Auth Setup ---');
    const adminRes = await axios.post(`${API_URL}/auth/admin/login`, { username: 'admin', password: 'secureAdminPassword123' });
    const adminToken = adminRes.data.data.token;
    
    const stuRes = await axios.post(`${API_URL}/auth/student/login`, { username: 'student101', password: 'studentpassword1' });
    const studentToken = stuRes.data.data.token;

    // Resolve student ID
    const stuResDB = await pool.query("SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.username = 'student101'");
    const student1Id = stuResDB.rows[0]?.id;

    // Setup an Assessment and Assignment
    // 1. Get/Create Question
    let qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
    let questions = qRes.data.data.questions;
    if (questions.length < 2) {
      await axios.post(`${API_URL}/questions`, { question_text: "Q1", category: "APTITUDE", difficulty: "EASY", option_a: "A", option_b: "B", option_c: "C", option_d: "D", correct_option: "A", marks: 2 }, { headers: { Authorization: `Bearer ${adminToken}` } });
      await axios.post(`${API_URL}/questions`, { question_text: "Q2", category: "APTITUDE", difficulty: "EASY", option_a: "A", option_b: "B", option_c: "C", option_d: "D", correct_option: "B", marks: 3 }, { headers: { Authorization: `Bearer ${adminToken}` } });
      qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
      questions = qRes.data.data.questions;
    }

    // 2. Create and Publish Assessment
    let createAss = await axios.post(`${API_URL}/assessments`, {
      title: "Result Test " + Date.now(),
      durationMinutes: 30,
      questionIds: [questions[0].id, questions[1].id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = createAss.data.data.id;
    await axios.patch(`${API_URL}/assessments/${assessmentId}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    // 3. Assign to student
    let assignRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId: assessmentId,
      studentIds: [student1Id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assignmentId = assignRes.data.data.assigned[0].id;

    console.log('\n--- SIMULATING ATTEMPT & EXAM SUBMISSION ---');
    let attemptRes = await axios.post(`${API_URL}/student/attempts`, { assignmentId }, { headers: { Authorization: `Bearer ${studentToken}` } });
    const attemptId = attemptRes.data.data.id;

    let fetchQRes = await axios.get(`${API_URL}/student/attempts/${attemptId}/questions`, { headers: { Authorization: `Bearer ${studentToken}` } });
    
    // Answer the first question correctly (fetch from DB to know the right answer just for testing)
    const dbQ1 = await pool.query(`SELECT correct_option FROM questions WHERE id = $1`, [fetchQRes.data.data[0].id]);
    await axios.post(`${API_URL}/student/attempts/${attemptId}/answers`, {
      questionId: fetchQRes.data.data[0].id,
      selectedOption: dbQ1.rows[0].correct_option
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    // Leave the second question unanswered for the test
    
    let submitRes = await axios.post(`${API_URL}/student/attempts/${attemptId}/submit`, {}, { headers: { Authorization: `Bearer ${studentToken}` } });
    const resultId = submitRes.data.data.result.id;

    console.log('\n--- TEST 1: Result automatically created on submit ---');
    console.log(submitRes.data.data.result ? '✅ Passed' : '❌ Failed');
    console.log('Stats from submit response:', submitRes.data.data.result.correct_answers, 'Correct,', submitRes.data.data.result.wrong_answers, 'Wrong,', submitRes.data.data.result.unanswered, 'Unanswered');

    console.log('\n--- TEST 2: Student views results list ---');
    let stuResults = await axios.get(`${API_URL}/student/results`, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(stuResults.status === 200 && stuResults.data.data.length > 0 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 3: Student views specific result ---');
    let stuResultSingle = await axios.get(`${API_URL}/student/results/${resultId}`, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(stuResultSingle.status === 200 && stuResultSingle.data.data.id === resultId ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 4: Admin views results list ---');
    let adminResults = await axios.get(`${API_URL}/results`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(adminResults.status === 200 && adminResults.data.data.results.length > 0 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 5: Admin filters result by assessmentId ---');
    let adminFilter = await axios.get(`${API_URL}/results?assessmentId=${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(adminFilter.status === 200 && adminFilter.data.data.results.length === 1 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 6: Admin views specific result ---');
    let adminResultSingle = await axios.get(`${API_URL}/results/${resultId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(adminResultSingle.status === 200 && adminResultSingle.data.data.id === resultId ? '✅ Passed' : '❌ Failed');

  } catch(err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  } finally {
    pool.end();
  }
}

runTests();
