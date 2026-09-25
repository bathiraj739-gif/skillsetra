const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- Auth Setup ---');
    // Admin login
    let res = await axios.post(`${API_URL}/auth/admin/login`, { username: 'admin', password: 'secureAdminPassword123' });
    const adminToken = res.data.data.token;
    
    // Student login (created in step 9)
    let stuRes = await axios.post(`${API_URL}/auth/student/login`, { username: 'student101', password: 'studentpassword1' });
    const studentToken = stuRes.data.data.token;

    // Get active questions to use
    let qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const questions = qRes.data.data.questions;
    if (questions.length < 1) {
      console.log('Need questions. Creating one...');
      const createdQ = await axios.post(`${API_URL}/questions`, {
        question_text: "Temp Q for Assessment " + Date.now(),
        category: "APTITUDE",
        difficulty: "EASY",
        option_a: "A", option_b: "B", option_c: "C", option_d: "D",
        correct_option: "A", marks: 2
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      questions.push(createdQ.data.data);
    }
    const validQuestionId = questions[0].id;

    console.log('\n--- TEST 6: POST /api/assessments ---');
    let createRes = await axios.post(`${API_URL}/assessments`, {
      title: "Test Assessment " + Date.now(),
      description: "A test assessment",
      durationMinutes: 30,
      questionIds: [validQuestionId]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = createRes.data.data.id;
    console.log(createRes.status === 201 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 7: GET /api/assessments ---');
    let listRes = await axios.get(`${API_URL}/assessments`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(listRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 8: GET /api/assessments/:id ---');
    let getRes = await axios.get(`${API_URL}/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(getRes.status === 200 && getRes.data.data.questions.length === 1 && getRes.data.data.questions[0].correct_option === undefined ? '✅ Passed (No correct_option exposed)' : '❌ Failed');

    console.log('\n--- TEST 9: PUT /api/assessments/:id ---');
    let putRes = await axios.put(`${API_URL}/assessments/${assessmentId}`, {
      title: "Updated Title",
      durationMinutes: 45
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(putRes.status === 200 && putRes.data.data.duration_minutes === 45 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 10: PATCH /api/assessments/:id/publish ---');
    let publishRes = await axios.patch(`${API_URL}/assessments/${assessmentId}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(publishRes.status === 200 && publishRes.data.data.status === 'PUBLISHED' ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 11: PATCH /api/assessments/:id/close ---');
    let closeRes = await axios.patch(`${API_URL}/assessments/${assessmentId}/close`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(closeRes.status === 200 && closeRes.data.data.status === 'CLOSED' ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 12: DELETE /api/assessments/:id ---');
    let delRes = await axios.delete(`${API_URL}/assessments/${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(delRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 13: Test invalid question ID ---');
    try {
      await axios.post(`${API_URL}/assessments`, {
        title: "Test", durationMinutes: 30, questionIds: ["00000000-0000-0000-0000-000000000000"]
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('❌ Failed');
    } catch (e) {
      console.log(e.response.status === 400 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 14: Test inactive question ---');
    // Create a question, delete it, then try to use it
    let tempQ = await axios.post(`${API_URL}/questions`, {
      question_text: "Inactive Q", category: "APTITUDE", difficulty: "EASY", option_a: "1", option_b: "2", option_c: "3", option_d: "4", correct_option: "A", marks: 1
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    await axios.delete(`${API_URL}/questions/${tempQ.data.data.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    
    try {
      await axios.post(`${API_URL}/assessments`, {
        title: "Test", durationMinutes: 30, questionIds: [tempQ.data.data.id]
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('❌ Failed');
    } catch (e) {
      console.log(e.response.status === 400 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 15: Test student token (403) ---');
    try {
      await axios.get(`${API_URL}/assessments`, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch (e) {
      console.log(e.response.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 16: Test unauthenticated request (401) ---');
    try {
      await axios.get(`${API_URL}/assessments`);
      console.log('❌ Failed');
    } catch (e) {
      console.log(e.response.status === 401 ? '✅ Passed' : '❌ Failed');
    }

  } catch (err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  }
}

runTests();
