// backend/scripts/testStep6Auth.js
// Dedicated automated test for STEP 6 — JWT AUTHENTICATION

async function runStep6Tests() {
  const BASE_URL = 'http://localhost:5000/api'
  console.log('🧪 Starting Step 6 — JWT Authentication Test Suite...\n')

  let passed = 0
  let total = 0

  function assert(condition, message) {
    total++
    if (condition) {
      console.log(`✅ [PASS] ${message}`)
      passed++
    } else {
      console.error(`❌ [FAIL] ${message}`)
      process.exit(1)
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/health`)
    const health = await healthRes.json()
    assert(healthRes.status === 200 && health.success === true, 'GET /api/health returns 200 OK')

    // 2. Admin Login with invalid credentials -> 401
    const badAdminRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword' }),
    })
    const badAdmin = await badAdminRes.json()
    assert(badAdminRes.status === 401 && badAdmin.success === false, 'POST /api/auth/admin/login returns 401 on invalid credentials')

    // 3. Admin Login with valid credentials -> 200 & JWT
    const adminRes = await fetch(`${BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'CMS@Admin' }),
    })
    const adminData = await adminRes.json()
    assert(adminRes.status === 200 && adminData.success === true && !!adminData.token, 'POST /api/auth/admin/login returns 200 with JWT')
    assert(adminData.user && adminData.user.role === 'admin' && !adminData.user.password_hash, 'Admin response contains user profile and NO password_hash')

    const adminToken = adminData.token

    // 4. Admin GET /api/auth/me
    const adminMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    })
    const adminMe = await adminMeRes.json()
    assert(adminMeRes.status === 200 && adminMe.success === true && adminMe.user.role === 'admin', 'GET /api/auth/me returns 200 with admin profile')

    // 5. Create a test candidate student to verify student login
    const studentUsername = 'stud_' + Math.floor(Math.random() * 100000)
    const createStudRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Test Candidate',
        email: `${studentUsername}@example.edu`,
        studentId: studentUsername,
        department: 'Computer Science',
        year: '4th Year',
        section: 'A',
        password: 'Candidate@Pass123',
      }),
    })
    const createStud = await createStudRes.json()
    assert(createStudRes.status === 201 && createStud.success === true, 'Admin successfully created candidate for student login verification')

    // 6. Student Login with invalid credentials -> 401
    const badStudentRes = await fetch(`${BASE_URL}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: studentUsername, password: 'WrongPassword' }),
    })
    assert(badStudentRes.status === 401, 'POST /api/auth/student/login returns 401 on invalid credentials')

    // 7. Student Login with valid credentials -> 200 & JWT
    const studentRes = await fetch(`${BASE_URL}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: studentUsername, password: 'Candidate@Pass123' }),
    })
    const studentData = await studentRes.json()
    assert(studentRes.status === 200 && studentData.success === true && !!studentData.token, 'POST /api/auth/student/login returns 200 with JWT')
    assert(studentData.user && studentData.user.role === 'student' && !studentData.user.password_hash, 'Student response contains student details and NO password_hash')

    const studentToken = studentData.token

    // 8. Student GET /api/auth/me
    const studentMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    })
    const studentMe = await studentMeRes.json()
    assert(studentMeRes.status === 200 && studentMe.success === true && studentMe.user.role === 'student', 'GET /api/auth/me returns 200 with student profile')

    // 9. Unauthorized request with no token -> 401
    const noTokenRes = await fetch(`${BASE_URL}/auth/me`)
    assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized')

    // 10. Unauthorized request with invalid token -> 401
    const badTokenRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': 'Bearer invalid.token.value' },
    })
    assert(badTokenRes.status === 401, 'GET /api/auth/me with invalid token returns 401 Unauthorized')

    // 11. Role Authorization: Student cannot access Admin routes -> 403
    const forbiddenAdminRes = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${studentToken}` },
    })
    assert(forbiddenAdminRes.status === 403, 'requireAdmin middleware blocks student role with 403 Forbidden')

    // 12. Logout endpoint -> 200
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` },
    })
    const logoutData = await logoutRes.json()
    assert(logoutRes.status === 200 && logoutData.success === true, 'POST /api/auth/logout returns 200 OK')

    console.log(`\n🎉 Step 6 Complete: ${passed}/${total} assertions passed successfully!\n`)
  } catch (err) {
    console.error('❌ Test failed with error:', err)
    process.exit(1)
  }
}

runStep6Tests()
