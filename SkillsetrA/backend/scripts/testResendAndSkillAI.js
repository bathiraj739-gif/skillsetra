require('dotenv').config();
const http = require('http');
const pool = require('../src/config/db');
const app = require('../src/app');
const emailService = require('../src/services/emailService');
const jwt = require('jsonwebtoken');

let server;
let baseUrl;
let adminToken;

async function setup() {
  // Generate admin token
  const adminUser = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1");
  if (adminUser.rows.length === 0) {
    throw new Error('No admin user found');
  }
  const admin = adminUser.rows[0];
  adminToken = jwt.sign(
    { userId: admin.id, username: admin.username, role: admin.role },
    process.env.JWT_SECRET || 'skillsetra_super_secret_key_change_this_later',
    { expiresIn: '1h' }
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server active on port ${port}`);
      resolve();
    });
  });
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 TESTING RESEND EMAIL SERVICE & SKILL AI AGENT');
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`✅ PASS: ${name} ${extra ? `(${extra})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${extra ? `(${extra})` : ''}`);
      failed++;
    }
  }

  try {
    await setup();

    // -------------------------------------------------------------
    // PART 1: RESEND EMAIL SERVICE TESTING
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Resend Email System ---');

    // 1.1 Validate Config
    const isConfigValid = emailService.validateEmailConfig();
    assert('Resend API Configuration Validated', isConfigValid);

    // 1.2 Outbound Test Email via Resend
    const testEmailResult = await emailService.sendTestEmail({ to: 'delivered@resend.dev' });
    assert('Send Diagnostic Test Email via Resend', testEmailResult.success === true, `Message ID: ${testEmailResult.messageId}`);

    // 1.3 Outbound Student Welcome Email
    const welcomeEmailResult = await emailService.sendStudentWelcomeEmail({
      to: 'delivered@resend.dev',
      studentName: 'Arun Kumar',
      registerNumber: 'ST2026-TEST',
      username: 'arunkumar_test',
      initialPassword: 'Password@2026'
    });
    assert('Send Student Welcome Email via Resend', welcomeEmailResult.success === true && welcomeEmailResult.sent === true, `Message ID: ${welcomeEmailResult.messageId}`);

    // 1.4 Outbound Assignment Assigned Email
    const assignmentEmailResult = await emailService.sendAssignmentAssignedEmail({
      to: 'delivered@resend.dev',
      studentName: 'Arun Kumar',
      assessmentTitle: 'TCS Placement Aptitude Mock 2026',
      durationMinutes: 45,
      assignedAt: new Date().toLocaleString()
    });
    assert('Send Assignment Notification Email via Resend', assignmentEmailResult.success === true && assignmentEmailResult.sent === true, `Message ID: ${assignmentEmailResult.messageId}`);

    // 1.5 Outbound Assessment Completed Email
    const completedEmailResult = await emailService.sendAssessmentCompletedEmail({
      to: 'delivered@resend.dev',
      studentName: 'Arun Kumar',
      assessmentTitle: 'TCS Placement Aptitude Mock 2026',
      score: 28,
      totalMarks: 30,
      percentage: 93.3,
      correctAnswers: 28,
      wrongAnswers: 2,
      unanswered: 0
    });
    assert('Send Assessment Completed Results Email via Resend', completedEmailResult.success === true && completedEmailResult.sent === true, `Message ID: ${completedEmailResult.messageId}`);

    // -------------------------------------------------------------
    // PART 2: SKILL AI COPILOT & AGENT TESTING
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Skill AI Agent Copilot ---');

    // 2.1 Skill AI Chat: Help / Guidance
    const chatHelpRes = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ message: 'What can you do? help me with features' })
    });
    const helpData = await chatHelpRes.json();
    assert('Skill AI Chat - Help & Guidance Intent', chatHelpRes.status === 200 && helpData.success === true, `Intent: ${helpData.data?.intent}`);

    // 2.2 Skill AI Chat: Candidate Count Query
    const countStudentsRes = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ message: 'How many students are registered in CSE?' })
    });
    const countData = await countStudentsRes.json();
    assert('Skill AI Chat - Count Students Query', countStudentsRes.status === 200 && countData.success === true, `Response: ${countData.data?.reply || countData.data?.explanation}`);

    // 2.3 Skill AI Chat: Dashboard Statistics
    const dashStatsRes = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ message: 'Show platform overview statistics' })
    });
    const dashData = await dashStatsRes.json();
    assert('Skill AI Chat - Platform Overview Telemetry', dashStatsRes.status === 200 && dashData.success === true, `Intent: ${dashData.data?.intent}`);

    // 2.4 Skill AI Chat: Assessment Creation Preview
    const createAssRes = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ message: 'Create a 45 minute aptitude assessment with 25 questions called Placement Mock Drive 1' })
    });
    const createData = await createAssRes.json();
    assert('Skill AI Chat - Action Preview for Assessment Creation', createAssRes.status === 200 && (createData.data?.intent === 'CREATE_ASSESSMENT' || createData.data?.preview !== undefined), `Intent: ${createData.data?.intent}`);

    // 2.5 Skill AI Agent History Endpoint
    const historyRes = await fetch(`${baseUrl}/api/agent/history`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const histData = await historyRes.json();
    assert('Skill AI Chat History Endpoint', historyRes.status === 200 && histData.success === true, `History count: ${histData.data?.length || 0}`);

  } catch (err) {
    console.error('Fatal Test Exception:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    console.log('\n=============================================================');
    console.log('📊 TEST SUMMARY');
    console.log('=============================================================');
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('=============================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
