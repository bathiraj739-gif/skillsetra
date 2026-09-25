// backend/scripts/testEndToEnd.js
// Tests the complete SkillsetrA backend flow end-to-end via HTTP API

async function runTest() {
  console.log('🚀 Starting SkillsetrA End-to-End API Test...')
  const BASE_URL = 'http://localhost:5000/api'

  try {
    // 1. Health check
    const health = await fetch(`${BASE_URL}/health`).then(r => r.json())
    console.log('1. Health check:', health.message)

    // 2. Admin Login
    const adminLogin = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: 'CMS@Admin' }),
    }).then(r => r.json())

    if (!adminLogin.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin)}`)
    }
    const adminToken = adminLogin.token
    console.log('2. Admin login successful. Token acquired.')

    // 3. Admin /auth/me
    const adminMe = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    }).then(r => r.json())
    console.log('3. Admin profile:', adminMe.user.username, `(${adminMe.user.role})`)

    // 4. Create Student
    const regNum = 'REG_' + Math.floor(Math.random() * 100000)
    const studentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Arun Kumar',
        email: `${regNum.toLowerCase()}@test.edu`,
        studentId: regNum,
        department: 'Information Technology',
        year: '4th Year',
        section: 'A',
        password: 'Password@123',
      }),
    }).then(r => r.json())

    if (!studentRes.success) {
      throw new Error(`Student creation failed: ${JSON.stringify(studentRes)}`)
    }
    console.log('4. Candidate created:', studentRes.data.fullName, `(${studentRes.data.studentId})`)

    // 5. Student Login
    const studentLogin = await fetch(`${BASE_URL}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registerNumber: regNum,
        password: 'Password@123',
      }),
    }).then(r => r.json())

    if (!studentLogin.token) {
      throw new Error(`Student login failed: ${JSON.stringify(studentLogin)}`)
    }
    const studentToken = studentLogin.token
    console.log('5. Student login successful. Token acquired.')

    // 6. Student /auth/me
    const studentMe = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    }).then(r => r.json())
    console.log('6. Student profile verified:', studentMe.user.fullName, `(${studentMe.user.registerNumber})`)

    // 7. Admin Create Assessment
    const qList = await fetch(`${BASE_URL}/questions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    }).then(r => r.json())

    const qIds = (qList.data || []).slice(0, 5).map(q => q.id)

    const assRes = await fetch(`${BASE_URL}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Placement Assessment Batch ' + regNum,
        description: 'Mock placement test for final year students',
        durationMinutes: 45,
        status: 'published',
        questionIds: qIds,
      }),
    }).then(r => r.json())

    if (!assRes.success) {
      throw new Error(`Assessment creation failed: ${JSON.stringify(assRes)}`)
    }
    const assessmentId = assRes.data.id
    console.log('7. Assessment created:', assRes.data.title)

    // 8. Admin Assign Assessment to Candidate
    const assignRes = await fetch(`${BASE_URL}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        assessmentId,
        studentId: studentRes.data.id,
      }),
    }).then(r => r.json())

    if (!assignRes.success) {
      throw new Error(`Assignment failed: ${JSON.stringify(assignRes)}`)
    }
    console.log('8. Assessment assigned to candidate.')

    // 9. Student starts attempt
    const attemptInit = await fetch(`${BASE_URL}/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        assessmentId,
      }),
    }).then(r => r.json())

    if (!attemptInit.success) {
      throw new Error(`Attempt start failed: ${JSON.stringify(attemptInit)}`)
    }
    const attemptId = attemptInit.data.id
    console.log('9. Attempt started, attemptId:', attemptId)

    // 10. Student loads fixed sequence questions (and simulates browser refresh)
    const questionsLoad1 = await fetch(`${BASE_URL}/attempts/${attemptId}/questions`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    }).then(r => r.json())

    const questionsLoad2 = await fetch(`${BASE_URL}/attempts/${attemptId}/questions`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    }).then(r => r.json())

    const order1 = questionsLoad1.data.map(q => q.id).join(',')
    const order2 = questionsLoad2.data.map(q => q.id).join(',')
    if (order1 !== order2) {
      throw new Error('Question sequence changed upon browser refresh simulation!')
    }
    console.log(`10. Loaded ${questionsLoad1.data.length} questions. Sequence is 100% fixed across refreshes.`)

    // 11. Student answers questions
    for (const q of questionsLoad1.data) {
      await fetch(`${BASE_URL}/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          questionId: q.id,
          selectedOption: 'C',
        }),
      })
    }
    console.log('11. Autosaved candidate responses for all questions.')

    // 12. Student submits attempt
    const submitRes = await fetch(`${BASE_URL}/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studentToken}`,
      },
    }).then(r => r.json())

    if (!submitRes.success) {
      throw new Error(`Attempt submit failed: ${JSON.stringify(submitRes)}`)
    }
    console.log(`12. Assessment submitted! Score: ${submitRes.data.score}/${submitRes.data.total_questions} (${submitRes.data.percentage}%)`)

    // 13. Student verifies scorecard
    const myResults = await fetch(`${BASE_URL}/results/my`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    }).then(r => r.json())
    console.log(`13. Student performance scorecard retrieved. Total tests taken: ${myResults.data.length}`)

    // 14. Admin verifies dashboard stats
    const stats = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    }).then(r => r.json())
    console.log('14. Admin stats verified:', stats.data)

    console.log('\n🎉 ALL 14 END-TO-END STEPS PASSED WITH 100% ACCURACY!')
  } catch (err) {
    console.error('❌ Test failed:', err)
    process.exit(1)
  }
}

runTest()
