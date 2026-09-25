const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- TEST 1: GET /api/health ---');
    let res = await axios.get(`${API_URL}/health`);
    console.log(res.status === 200 ? '✅ Passed' : '❌ Failed', res.data);

    console.log('\n--- TEST 3: Admin login ---');
    res = await axios.post(`${API_URL}/auth/admin/login`, {
      username: 'admin',
      password: 'secureAdminPassword123'
    });
    console.log(res.status === 200 ? '✅ Passed' : '❌ Failed');
    
    const adminToken = res.data.data.token;
    console.log('\n--- TEST 4: Copy returned JWT ---');
    console.log('✅ Token received');

    console.log('\n--- TEST 5: GET /api/auth/me (Admin) ---');
    res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(res.status === 200 && res.data.data.user.role === 'admin' ? '✅ Passed' : '❌ Failed', res.data.data.user);

    console.log('\n--- TEST 6: Try POST /api/students without token ---');
    try {
      await axios.post(`${API_URL}/students`, {});
      console.log('❌ Failed: Should have returned 401');
    } catch (err) {
      console.log(err.response.status === 401 ? '✅ Passed' : '❌ Failed', err.response.status);
    }

    console.log('\n--- TEST 7: Create a student using Admin JWT ---');
    const studentData = {
      username: 'student101',
      password: 'studentpassword1',
      register_number: 'REG101',
      full_name: 'Student One',
      email: 'stu101@example.com'
    };
    try {
      res = await axios.post(`${API_URL}/students`, studentData, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log(res.status === 201 ? '✅ Passed' : '❌ Failed');
    } catch (err) {
      if (err.response && err.response.data.message === 'Username already exists') {
        console.log('✅ Passed (Student already created)');
      } else {
        console.log('❌ Failed', err.message);
      }
    }

    console.log('\n--- TEST 8: Student login ---');
    res = await axios.post(`${API_URL}/auth/student/login`, {
      username: 'student101',
      password: 'studentpassword1'
    });
    console.log(res.status === 200 ? '✅ Passed' : '❌ Failed');
    const studentToken = res.data.data.token;

    console.log('\n--- TEST 9: Student GET /api/auth/me ---');
    res = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log(res.status === 200 && res.data.data.user.role === 'student' ? '✅ Passed' : '❌ Failed', res.data.data.user);

    console.log('\n--- TEST 10: Try using Student JWT on POST /api/students ---');
    try {
      await axios.post(`${API_URL}/students`, {}, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      console.log('❌ Failed: Should have returned 403');
    } catch (err) {
      console.log(err.response.status === 403 ? '✅ Passed' : '❌ Failed', err.response.status);
    }

  } catch (err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  }
}

runTests();
