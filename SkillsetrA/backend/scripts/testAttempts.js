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
    if (!student1Id) throw new Error('Could not find student101');

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
    const q1 = questions[0].id;
    const q2 = questions[1].id;

    // 2. Create and Publish Assessment
    let createAss = await axios.post(`${API_URL}/assessments`, {
      title: "Attempt Test " + Date.now(),
      durationMinutes: 30,
      questionIds: [q1, q2]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = createAss.data.data.id;
    await axios.patch(`${API_URL}/assessments/${assessmentId}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    // 3. Assign to student
    let assignRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId: assessmentId,
      studentIds: [student1Id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assignmentId = assignRes.data.data.assigned[0].id;

    console.log('\n--- TEST 1: Student starts attempt ---');
    let attemptRes = await axios.post(`${API_URL}/student/attempts`, { assignmentId }, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(attemptRes.status === 201 ? '✅ Passed' : '❌ Failed');
    const attemptId = attemptRes.data.data.id;

    console.log('\n--- TEST 2: Student starts attempt AGAIN (should fail) ---');
    try {
      await axios.post(`${API_URL}/student/attempts`, { assignmentId }, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response?.status === 400 && e.response?.data.message === 'Attempt already started' ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 3: Student fetches questions (order must be fixed) ---');
    let fetchQRes1 = await axios.get(`${API_URL}/student/attempts/${attemptId}/questions`, { headers: { Authorization: `Bearer ${studentToken}` } });
    let fetchQRes2 = await axios.get(`${API_URL}/student/attempts/${attemptId}/questions`, { headers: { Authorization: `Bearer ${studentToken}` } });
    
    const qList1 = fetchQRes1.data.data.map(q => q.id).join(',');
    const qList2 = fetchQRes2.data.data.map(q => q.id).join(',');
    console.log(fetchQRes1.status === 200 && qList1 === qList2 && fetchQRes1.data.data.length === 2 ? '✅ Passed' : '❌ Failed');
    
    // Also check if correct_option is NOT leaked
    const isLeaked = fetchQRes1.data.data.some(q => q.correct_option !== undefined);
    console.log(isLeaked === false ? '✅ Passed (correct_option hidden)' : '❌ Failed');

    console.log('\n--- TEST 4: Student saves an answer (auto-saves) ---');
    let ansRes = await axios.post(`${API_URL}/student/attempts/${attemptId}/answers`, {
      questionId: fetchQRes1.data.data[0].id,
      selectedOption: 'A'
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(ansRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 5: Student fetches questions again, sees saved answer ---');
    let fetchQRes3 = await axios.get(`${API_URL}/student/attempts/${attemptId}/questions`, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(fetchQRes3.data.data[0].selected_option === 'A' ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 6: Student submits exam ---');
    let submitRes = await axios.post(`${API_URL}/student/attempts/${attemptId}/submit`, {}, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(submitRes.status === 200 && submitRes.data.data.status === 'SUBMITTED' ? '✅ Passed' : '❌ Failed');
    console.log(`Calculated Score: ${submitRes.data.data.score}`);

    console.log('\n--- TEST 7: Save answer after submission (should fail) ---');
    try {
      await axios.post(`${API_URL}/student/attempts/${attemptId}/answers`, {
        questionId: fetchQRes1.data.data[1].id,
        selectedOption: 'C'
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response?.status === 400 && e.response?.data.message === 'Attempt is not in progress' ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 8: Submit already submitted attempt (should fail) ---');
    try {
      await axios.post(`${API_URL}/student/attempts/${attemptId}/submit`, {}, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response?.status === 400 && e.response?.data.message === 'Attempt already submitted' ? '✅ Passed' : '❌ Failed');
    }

  } catch(err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  } finally {
    pool.end();
  }
}

runTests();
