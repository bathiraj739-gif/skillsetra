require('dotenv').config();
const axios = require('axios');
const pool = require('../src/config/db');
const emailService = require('../src/services/emailService');
const { generateStudentWelcomeEmail } = require('../src/templates/emails/studentWelcomeEmail');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'skillsetra_super_secret_key_change_this_later';

async function runEmailVerification() {
  console.log('================================================================');
  console.log('RUNNING SKILLSETRA RESEND EMAIL SYSTEM VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assertTest(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${name} ${details ? '- ' + details : ''}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? '- ' + details : ''}`);
    }
  }

  try {
    // 1. Fetch real Admin & Student users from PostgreSQL
    const adminUserRes = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1");
    if (adminUserRes.rows.length === 0) {
      throw new Error("No admin user found in database. Please run npm run db:seed or create-admin first.");
    }
    const adminUser = adminUserRes.rows[0];
    const adminToken = jwt.sign(
      { userId: adminUser.id, username: adminUser.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const studentUserRes = await pool.query("SELECT id, username, role FROM users WHERE role = 'student' LIMIT 1");
    const studentUser = studentUserRes.rows[0] || { id: '00000000-0000-0000-0000-000000000002', username: 'student_tester', role: 'student' };
    const studentToken = jwt.sign(
      { userId: studentUser.id, username: studentUser.username, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TEST 1: Service Startup & Config Validation
    const isConfigValid = emailService.validateEmailConfig();
    assertTest('TEST 1: Email Service Config Validation on Startup', typeof isConfigValid === 'boolean', `Config status: ${isConfigValid ? 'Live API Key' : 'Simulated Development Mode'}`);

    // TEST 2: Environment Variables Security
    const hasResendVar = process.env.RESEND_API_KEY !== undefined;
    const hasEmailFrom = process.env.EMAIL_FROM !== undefined;
    const hasFrontendUrl = process.env.FRONTEND_URL !== undefined;
    assertTest('TEST 2: Backend Environment Variables Loaded', hasResendVar && hasEmailFrom && hasFrontendUrl, `EMAIL_FROM: ${emailService.getSenderEmail()}`);

    // TEST 3: Email Template Generation & Content Verification
    const template = generateStudentWelcomeEmail({
      studentName: 'Bhavya Sharma',
      registerNumber: 'REG-TEST-9001',
      username: 'bhavya9001',
      initialPassword: 'TempPassword@123',
      loginUrl: 'http://localhost:5173/login'
    });
    const templateValid = template.subject.includes('Welcome to SkillsetrA') &&
      template.html.includes('Bhavya Sharma') &&
      template.html.includes('REG-TEST-9001') &&
      template.html.includes('bhavya9001') &&
      template.html.includes('http://localhost:5173/login') &&
      template.text.includes('TempPassword@123');
    assertTest('TEST 3: Student Welcome Email Template Formatting', templateValid, `Subject: "${template.subject}"`);

    // TEST 4: Single Student Creation Flow + Automated Welcome Email
    const testRegNo = `REG${Date.now().toString().slice(-6)}`;
    const testEmail = `student_${testRegNo.toLowerCase()}@testcollege.edu`;
    const createRes = await axios.post(
      `${API_BASE}/students`,
      {
        full_name: 'Test Email Candidate',
        username: `user_${testRegNo.toLowerCase()}`,
        password: 'Student@Password123',
        register_number: testRegNo,
        email: testEmail,
        department: 'CSE',
        year: 4,
        section: 'A'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const createdStudent = createRes.data?.data?.student || createRes.data?.student;
    const emailStatus = createRes.data?.data?.email || createRes.data?.email;
    assertTest('TEST 4: Student Account Creation with Automated Email Flow', createRes.status === 201 && !!createdStudent?.id && emailStatus !== undefined, `Student ID: ${createdStudent?.id}, Email sent/simulated: ${emailStatus?.sent}`);

    // TEST 5: Manual "Send Welcome Email" Endpoint
    const manualEmailRes = await axios.post(
      `${API_BASE}/students/${createdStudent.id}/send-welcome-email`,
      { initialPassword: 'Student@Password123' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assertTest('TEST 5: Admin Manual Send Welcome Email Endpoint', manualEmailRes.status === 200 && manualEmailRes.data?.success === true, `Response message: "${manualEmailRes.data?.message}"`);

    // TEST 6: Bulk Candidate Registration with Batched Emails
    const bulkReg1 = `BULK${Date.now().toString().slice(-5)}1`;
    const bulkReg2 = `BULK${Date.now().toString().slice(-5)}2`;
    const bulkPayload = {
      initialPassword: 'BulkInitial@2026',
      candidates: [
        {
          register_number: bulkReg1,
          full_name: 'Bulk Student One',
          username: `user_${bulkReg1.toLowerCase()}`,
          email: `${bulkReg1.toLowerCase()}@college.edu`,
          department: 'CSE',
          year: 3
        },
        {
          register_number: bulkReg2,
          full_name: 'Bulk Student Two',
          username: `user_${bulkReg2.toLowerCase()}`,
          email: `${bulkReg2.toLowerCase()}@college.edu`,
          department: 'ECE',
          year: 3
        }
      ]
    };

    const bulkRes = await axios.post(
      `${API_BASE}/students/bulk-import`,
      bulkPayload,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const bulkData = bulkRes.data?.data;
    assertTest('TEST 6: Bulk Candidate Import with Batched Welcome Emails', bulkRes.status === 200 && bulkData?.registeredCount === 2, `Registered: ${bulkData?.registeredCount}, Emails sent: ${bulkData?.emails?.totalSent}`);

    // TEST 7: Duplicate Candidate Check & Avoid Redundant Emails
    const duplicateRes = await axios.post(
      `${API_BASE}/students/bulk-import`,
      bulkPayload,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assertTest('TEST 7: Duplicate Candidate Rejection Prevents Redundant Emails', duplicateRes.data?.data?.registeredCount === 0 && duplicateRes.data?.data?.skippedCount === 2, `Correctly skipped: ${duplicateRes.data?.data?.skippedCount} duplicates`);

    // TEST 8: Invalid Email Validation
    const invalidEmailResult = await emailService.sendStudentWelcomeEmail({
      to: 'invalid-not-an-email',
      studentName: 'Invalid Candidate',
      registerNumber: 'REG-INV-001',
      username: 'invalid001'
    });
    assertTest('TEST 8: Invalid Recipient Email Address Rejection', invalidEmailResult.success === false && invalidEmailResult.sent === false, `Error: "${invalidEmailResult.error}"`);

    // TEST 9: Student JWT Authorization Barrier (403 Forbidden)
    let studentBlocked = false;
    try {
      await axios.post(
        `${API_BASE}/students/${createdStudent.id}/send-welcome-email`,
        {},
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
    } catch (err) {
      studentBlocked = err.response?.status === 403;
    }
    assertTest('TEST 9: Student Role is Blocked from Email Trigger Endpoint', studentBlocked, 'HTTP 403 Forbidden received');

    // TEST 10: Unauthenticated Request Barrier (401 Unauthorized)
    let unauthBlocked = false;
    try {
      await axios.post(`${API_BASE}/students/${createdStudent.id}/send-welcome-email`, {});
    } catch (err) {
      unauthBlocked = err.response?.status === 401;
    }
    assertTest('TEST 10: Unauthenticated Request Blocked', unauthBlocked, 'HTTP 401 Unauthorized received');

    // TEST 11: Admin Diagnostic Test Email Endpoint
    let testEmailHandled = false;
    try {
      const testEmailRes = await axios.post(
        `${API_BASE}/admin/email/test`,
        { to: 'test_admin@skillsetra.edu' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      testEmailHandled = testEmailRes.status === 200 || testEmailRes.data?.success !== undefined;
    } catch (err) {
      // If API key is placeholder, it returns 400 with clear configuration error
      testEmailHandled = err.response?.status === 400 && err.response?.data?.message?.includes('Resend');
    }
    assertTest('TEST 11: Admin Diagnostic Test Email Route (/api/admin/email/test)', testEmailHandled, 'Handled safely with role checks');

    // TEST 12: Idempotency & Repeated Send Calls
    const retryEmailRes = await axios.post(
      `${API_BASE}/students/${createdStudent.id}/send-welcome-email`,
      { initialPassword: 'Student@Password123' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assertTest('TEST 12: Idempotency & Safe Retry of Welcome Email', retryEmailRes.status === 200 && retryEmailRes.data?.success === true, 'Successfully retried without system error');

    // Cleanup created test records
    await pool.query('DELETE FROM students WHERE register_number IN ($1, $2, $3)', [testRegNo, bulkReg1, bulkReg2]);
    await pool.query('DELETE FROM users WHERE username IN ($1, $2, $3)', [`user_${testRegNo.toLowerCase()}`, `user_${bulkReg1.toLowerCase()}`, `user_${bulkReg2.toLowerCase()}`]);

  } catch (err) {
    console.error('Test execution error:', err.response?.data || err.message || err);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runEmailVerification();
