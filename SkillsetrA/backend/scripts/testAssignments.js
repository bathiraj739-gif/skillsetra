const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function runTests() {
  try {
    console.log('--- Auth Setup ---');
    let res = await axios.post(`${API_URL}/auth/admin/login`, { username: 'admin', password: 'secureAdminPassword123' });
    const adminToken = res.data.data.token;
    
    let stuRes = await axios.post(`${API_URL}/auth/student/login`, { username: 'student101', password: 'studentpassword1' });
    const studentToken = stuRes.data.data.token;
    
    // Ensure we have a published assessment and at least two students
    const { Pool } = require('pg');
    require('dotenv').config();
    const p = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const stuResDB = await p.query("SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.username = 'student101'");
    const student1Id = stuResDB.rows[0]?.id;
    
    // Create another student if needed
    let student2Id;
    try {
      const newStu = await axios.post(`${API_URL}/students`, {
        register_number: "TEST002",
        full_name: "Test Student 2",
        email: "test2@test.com",
        department: "CSE",
        year: 4,
        section: "A",
        username: "student002",
        password: "password123"
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      const createdResDB = await p.query("SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.username = 'student002'");
      student2Id = createdResDB.rows[0]?.id;
    } catch(e) {
      const stuResDB2 = await p.query("SELECT s.id FROM students s JOIN users u ON s.user_id = u.id WHERE u.username = 'student002'");
      student2Id = stuResDB2.rows[0]?.id;
    }
    
    await p.end();

    if (!student1Id) {
      console.log('Error: Could not find student 1');
      return;
    }

    // Get active questions to use
    let qRes = await axios.get(`${API_URL}/questions`, { headers: { Authorization: `Bearer ${adminToken}` } });
    let questions = qRes.data.data.questions;
    if (questions.length < 1) {
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

    // Create assessment
    let createAss = await axios.post(`${API_URL}/assessments`, {
      title: "Test Assessment " + Date.now(),
      durationMinutes: 30,
      questionIds: [validQuestionId]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const assessmentId = createAss.data.data.id;

    // Publish assessment
    await axios.patch(`${API_URL}/assessments/${assessmentId}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    console.log('\n--- TEST 1: Admin creates assignment ---');
    let createRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId: assessmentId,
      studentIds: [student1Id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(createRes.status === 201 ? '✅ Passed' : '❌ Failed');
    const assignmentId = createRes.data.data.assigned[0].id;

    console.log('\n--- TEST 2: Admin assigns one assessment to multiple students ---');
    let createMultipleRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId: assessmentId,
      studentIds: [student1Id, student2Id] // student1Id is already assigned, student2Id is new
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(createMultipleRes.status === 201 && createMultipleRes.data.data.assigned.length === 1 && createMultipleRes.data.data.alreadyAssigned.includes(student1Id) ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 3: Assign same assessment to same student again ---');
    let dupRes = await axios.post(`${API_URL}/assignments`, {
      assessmentId: assessmentId,
      studentIds: [student1Id]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(dupRes.status === 201 && dupRes.data.data.assigned.length === 0 && dupRes.data.data.alreadyAssigned.includes(student1Id) ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 4: Assign DRAFT assessment ---');
    let draftAss = await axios.post(`${API_URL}/assessments`, {
      title: "Draft Ass", durationMinutes: 30, questionIds: [validQuestionId]
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    try {
      await axios.post(`${API_URL}/assignments`, {
        assessmentId: draftAss.data.data.id, studentIds: [student1Id]
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 400 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 5: Assign CLOSED assessment ---');
    await axios.patch(`${API_URL}/assessments/${assessmentId}/close`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    try {
      await axios.post(`${API_URL}/assignments`, {
        assessmentId: assessmentId, studentIds: [student1Id]
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 400 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 6: Assign invalid student ID ---');
    // Re-publish a fresh assessment to test the invalid student properly without CLOSED error
    let freshAss = await axios.post(`${API_URL}/assessments`, { title: "Fresh Ass", durationMinutes: 30, questionIds: [validQuestionId] }, { headers: { Authorization: `Bearer ${adminToken}` } });
    await axios.patch(`${API_URL}/assessments/${freshAss.data.data.id}/publish`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    try {
      await axios.post(`${API_URL}/assignments`, {
        assessmentId: freshAss.data.data.id, studentIds: ["00000000-0000-0000-0000-000000000000"]
      }, { headers: { Authorization: `Bearer ${adminToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 400 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 7: Admin gets all assignments ---');
    let getAllRes = await axios.get(`${API_URL}/assignments`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(getAllRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 8: Admin filters assignments by assessment ---');
    let filterAssRes = await axios.get(`${API_URL}/assignments?assessmentId=${assessmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(filterAssRes.status === 200 && filterAssRes.data.data.assignments.length > 0 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 9: Admin filters by student ---');
    let filterStuRes = await axios.get(`${API_URL}/assignments?studentId=${student1Id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(filterStuRes.status === 200 && filterStuRes.data.data.assignments.length > 0 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 10: Student gets own assignments ---');
    let stuGetRes = await axios.get(`${API_URL}/student/assignments`, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log(stuGetRes.status === 200 && stuGetRes.data.data.length > 0 ? '✅ Passed' : '❌ Failed');
    const myAssignmentId = stuGetRes.data.data[0].id;

    console.log('\n--- TEST 11: Student tries another student\'s assignment ID ---');
    let filterStu2 = await axios.get(`${API_URL}/assignments?studentId=${student2Id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const student2AssignmentId = filterStu2.data.data.assignments[0].id;
    try {
      await axios.get(`${API_URL}/student/assignments/${student2AssignmentId}`, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 12: No JWT ---');
    try {
      await axios.get(`${API_URL}/assignments`);
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 401 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 13: Student token accesses admin assignment API ---');
    try {
      await axios.get(`${API_URL}/assignments`, { headers: { Authorization: `Bearer ${studentToken}` } });
      console.log('❌ Failed');
    } catch(e) {
      console.log(e.response.status === 403 ? '✅ Passed' : '❌ Failed');
    }

    console.log('\n--- TEST 14: Admin updates due date ---');
    let updateRes = await axios.put(`${API_URL}/assignments/${assignmentId}`, { dueAt: "2026-10-05T18:00:00.000Z" }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(updateRes.status === 200 && updateRes.data.data.due_at === "2026-10-05T18:00:00.000Z" ? '✅ Passed' : '❌ Failed');

    console.log('\n--- TEST 15: Admin deletes assignment before attempt ---');
    let delRes = await axios.delete(`${API_URL}/assignments/${assignmentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log(delRes.status === 200 ? '✅ Passed' : '❌ Failed');

    console.log('\n--- DB VERIFICATION SCRIPT ---');
  } catch (err) {
    console.error('Test Execution Failed:', err.response ? err.response.data : err.message);
  }
}

runTests();
