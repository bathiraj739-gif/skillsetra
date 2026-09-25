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

    console.log('\n--- TEST 1: Admin requests dashboard overview ---');
    let dbRes = await axios.get(`${API_URL}/admin/dashboard/overview`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(dbRes.status === 200 ? '✅ Passed' : '❌ Failed');
    
    console.log('\n--- TEST 2: Student requests dashboard overview (should fail) ---');
    try {
      await axios.get(`${API_URL}/admin/dashboard/overview`, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response?.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 3: Admin requests dashboard activity ---');
    let actRes = await axios.get(`${API_URL}/admin/dashboard/activity`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(actRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 4: Admin requests dashboard assessments ---');
    let dAssessmentsRes = await axios.get(`${API_URL}/admin/dashboard/assessments`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(dAssessmentsRes.status === 200 ? '✅ Passed' : '❌ Failed');

    // Get an assessmentId to test monitoring
    let assessList = await axios.get(`${API_URL}/assessments`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = assessList.data.data.assessments[0].id;

    console.log('\n--- TEST 5: Admin requests assessment monitoring ---');
    let monRes = await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(monRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 6: Student requests monitoring (should fail) ---');
    try {
      await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}`, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response?.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 7: Filter status=IN_PROGRESS ---');
    let progRes = await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}&status=IN_PROGRESS`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(progRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 8: Filter status=COMPLETED ---');
    let compRes = await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}&status=COMPLETED`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(compRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 9: Search by student ---');
    let searchRes = await axios.get(`${API_URL}/admin/monitoring?assessmentId=${assessmentId}&search=student101`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(searchRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 10: Dashboard for specific assessment ---');
    let specRes = await axios.get(`${API_URL}/admin/dashboard/overview?assessmentId=${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(specRes.status === 200 && specRes.data.data.statistics ? '✅ Passed' : '❌ Failed');

    if (monRes.data.data.students.length > 0) {
      const assignmentId = monRes.data.data.students[0].assignmentId;
      console.log('\n--- TEST 11: Admin requests assignment monitoring detail ---');
      let detRes = await axios.get(`${API_URL}/admin/monitoring/${assignmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log(detRes.status === 200 ? '✅ Passed' : '❌ Failed');
    }

  } catch(err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  } finally {
    pool.end();
  }
}

runTests();
