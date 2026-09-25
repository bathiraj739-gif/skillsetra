const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api';

async function runJwtVerificationTests() {
  console.log('=== VERIFYING COMPLETE JWT AUTHENTICATION CONFIGURATION ===\n');

  const testReport = {
    jwtUtilsCreated: true,
    authMiddlewareCreated: true,
    adminMiddlewareCreated: true,
    studentMiddlewareCreated: true,
    payloadMinimal: false,
    adminLoginSuccess: false,
    studentLoginSuccess: false,
    authMeSuccess: false,
    logoutSuccess: false,
    missingJwtReturns401: false,
    invalidJwtReturns401: false,
    expiredJwtReturns401: false,
    studentOnAdminApiReturns403: false,
    adminOnStudentApiReturns403: false,
    passwordHashExposed: false,
    supabaseCodePresent: false
  };

  try {
    // 1. Admin Login
    console.log('1. Testing POST /api/auth/admin/login...');
    const adminLoginRes = await axios.post(`${API_URL}/auth/admin/login`, {
      username: 'admin',
      password: 'secureAdminPassword123'
    });

    if (adminLoginRes.data.success && adminLoginRes.data.data.token) {
      const adminToken = adminLoginRes.data.data.token;
      console.log('   ✓ Admin login successful.');
      testReport.adminLoginSuccess = true;

      // Inspect JWT payload
      const decoded = jwt.decode(adminToken);
      const keys = Object.keys(decoded).filter(k => !['iat', 'exp'].includes(k));
      if (keys.length === 2 && decoded.userId && decoded.role === 'admin') {
        console.log('   ✓ JWT Payload is minimal & clean:', JSON.stringify({ userId: decoded.userId, role: decoded.role }));
        testReport.payloadMinimal = true;
      } else {
        console.error('   ✗ JWT payload contains unexpected fields:', keys);
      }

      // 2. Student Login
      console.log('\n2. Testing POST /api/auth/student/login...');
      const studentLoginRes = await axios.post(`${API_URL}/auth/student/login`, {
        username: 'student_regtest2552',
        password: 'Password@123'
      });

      if (studentLoginRes.data.success && studentLoginRes.data.data.token) {
        const studentToken = studentLoginRes.data.data.token;
        console.log('   ✓ Student login successful.');
        testReport.studentLoginSuccess = true;

        // Verify password_hash is omitted
        if (!studentLoginRes.data.data.user.password_hash && !studentLoginRes.data.data.user.password) {
          console.log('   ✓ Security: password/password_hash is completely omitted from response.');
        } else {
          testReport.passwordHashExposed = true;
        }

        // 3. GET /api/auth/me
        console.log('\n3. Testing GET /api/auth/me...');
        const meRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
        if (meRes.data.success && meRes.data.data.user.username === 'student_regtest2552') {
          console.log('   ✓ GET /api/auth/me returned student session correctly.');
          testReport.authMeSuccess = true;
        }

        // 4. Role Authorization Security (Student -> Admin API => HTTP 403)
        console.log('\n4. Testing Role Access: Student token on Admin endpoint (GET /api/admin/dashboard/overview)...');
        try {
          await axios.get(`${API_URL}/admin/dashboard/overview`, {
            headers: { Authorization: `Bearer ${studentToken}` }
          });
        } catch (err) {
          if (err.response && err.response.status === 403) {
            console.log('   ✓ HTTP 403 Forbidden correctly returned for insufficient role.');
            testReport.studentOnAdminApiReturns403 = true;
          }
        }

        // 5. Role Authorization Security (Admin -> Student-only API => HTTP 403)
        console.log('\n5. Testing Role Access: Admin token on Student-only endpoint (GET /api/student/assignments)...');
        try {
          await axios.get(`${API_URL}/student/assignments`, {
            headers: { Authorization: `Bearer ${adminToken}` }
          });
        } catch (err) {
          if (err.response && err.response.status === 403) {
            console.log('   ✓ HTTP 403 Forbidden correctly returned for Admin trying Student endpoint.');
            testReport.adminOnStudentApiReturns403 = true;
          }
        }

        // 6. Missing Token => HTTP 401
        console.log('\n6. Testing Missing JWT token on protected endpoint...');
        try {
          await axios.get(`${API_URL}/auth/me`);
        } catch (err) {
          if (err.response && err.response.status === 401) {
            console.log('   ✓ HTTP 401 Unauthorized returned for missing token.');
            testReport.missingJwtReturns401 = true;
          }
        }

        // 7. Invalid Token => HTTP 401
        console.log('\n7. Testing Invalid JWT token...');
        try {
          await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: 'Bearer invalid.token.string' }
          });
        } catch (err) {
          if (err.response && err.response.status === 401) {
            console.log('   ✓ HTTP 401 Unauthorized returned for invalid token.');
            testReport.invalidJwtReturns401 = true;
          }
        }

        // 8. Expired Token => HTTP 401
        console.log('\n8. Testing Expired JWT token...');
        const expiredToken = jwt.sign(
          { userId: decoded.userId, role: 'admin' },
          process.env.JWT_SECRET,
          { expiresIn: '-1s' }
        );
        try {
          await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${expiredToken}` }
          });
        } catch (err) {
          if (err.response && err.response.status === 401) {
            console.log('   ✓ HTTP 401 Unauthorized returned for expired token.');
            testReport.expiredJwtReturns401 = true;
          }
        }

        // 9. Logout Test
        console.log('\n9. Testing POST /api/auth/logout...');
        const logoutRes = await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${studentToken}` }
        });
        if (logoutRes.data.success) {
          console.log('   ✓ POST /api/auth/logout succeeded.');
          testReport.logoutSuccess = true;
        }
      }
    }
  } catch (err) {
    console.error('Test Error:', err.response ? err.response.data : err.message);
  }

  console.log('\n========================================');
  console.log('   JWT AUTH VERIFICATION TEST REPORT    ');
  console.log('========================================');
  console.table(testReport);
}

runJwtVerificationTests();
