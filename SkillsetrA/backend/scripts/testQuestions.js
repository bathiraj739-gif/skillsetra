const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- TEST 1: Admin login ---');
    let res = await axios.post(`${API_URL}/auth/admin/login`, {
      username: 'admin',
      password: 'secureAdminPassword123'
    });
    const adminToken = res.data.data.token;
    console.log('✅ Admin Token received');

    console.log('\n--- TEST 2: Create Aptitude question ---');
    let aptQ = await axios.post(`${API_URL}/questions`, {
      question_text: "What is 25% of 200? " + Date.now(),
      category: "APTITUDE",
      difficulty: "EASY",
      option_a: "25",
      option_b: "50",
      option_c: "75",
      option_d: "100",
      correct_option: "B",
      marks: 1
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(aptQ.status === 201 ? '✅ Passed' : '❌ Failed');
    
    console.log('\n--- TEST 3: Create Verbal question ---');
    let verbQ = await axios.post(`${API_URL}/questions`, {
      question_text: "Select synonym of PRUDENT " + Date.now(),
      category: "VERBAL",
      difficulty: "MEDIUM",
      option_a: "Reckless",
      option_b: "Cautious",
      option_c: "Foolish",
      option_d: "Careless",
      correct_option: "B",
      marks: 1
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(verbQ.status === 201 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 4: Get all questions ---');
    let allQs = await axios.get(`${API_URL}/questions`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(allQs.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 5: Filter: GET /api/questions?category=APTITUDE ---');
    let aptFilter = await axios.get(`${API_URL}/questions?category=APTITUDE`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allApt = aptFilter.data.data.questions.every(q => q.category === 'APTITUDE');
    console.log(allApt ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 6: Filter: GET /api/questions?category=VERBAL ---');
    let verbFilter = await axios.get(`${API_URL}/questions?category=VERBAL`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allVerb = verbFilter.data.data.questions.every(q => q.category === 'VERBAL');
    console.log(allVerb ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 7: Filter by difficulty ---');
    let diffFilter = await axios.get(`${API_URL}/questions?difficulty=EASY`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const allEasy = diffFilter.data.data.questions.every(q => q.difficulty === 'EASY');
    console.log(allEasy ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 8: Search question text ---');
    let searchFilter = await axios.get(`${API_URL}/questions?search=PRUDENT`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const hasSearch = searchFilter.data.data.questions.every(q => q.question_text.includes('PRUDENT'));
    console.log(hasSearch ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 9: Get question by ID ---');
    let singleQ = await axios.get(`${API_URL}/questions/${aptQ.data.data.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(singleQ.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 10: Update question ---');
    let updateQ = await axios.put(`${API_URL}/questions/${aptQ.data.data.id}`, {
      marks: 2
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(updateQ.status === 200 && updateQ.data.data.marks === 2 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 11: Delete question ---');
    let delQ = await axios.delete(`${API_URL}/questions/${aptQ.data.data.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(delQ.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 12: Try Question Bank API without JWT ---');
    try {
      await axios.get(`${API_URL}/questions`);
      console.log('❌ Failed: Should have returned 401');
    } catch(e) {
      console.log(e.response.status === 401 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 13: Login as Student and GET /api/questions ---');
    // First login as student101 created previously
    let stuRes = await axios.post(`${API_URL}/auth/student/login`, {
      username: 'student101',
      password: 'studentpassword1'
    });
    const studentToken = stuRes.data.data.token;
    try {
      await axios.get(`${API_URL}/questions`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      console.log('❌ Failed: Should have returned 403');
    } catch(e) {
      console.log(e.response.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 14: Try Student POST /api/questions ---');
    try {
      await axios.post(`${API_URL}/questions`, {}, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      console.log('❌ Failed: Should have returned 403');
    } catch(e) {
      console.log(e.response.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- DB VERIFICATION SCRIPT ---');
  } catch (err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  }
}

runTests();
