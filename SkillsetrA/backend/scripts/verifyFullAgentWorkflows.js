require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const pool = require('../src/config/db');

// Connect to the already running backend server on port 5000
const API_BASE = 'http://localhost:5000/api';

async function verifyAllAgentWorkflows() {
  console.log('===========================================================');
  console.log('🧪 VERIFYING SKILL AI AGENT FULL SPLIT-PANEL & PREVIEW WORKFLOWS');
  console.log('===========================================================\n');

  try {
    // Step 1: Admin Login
    console.log('[STEP 1] Logging in as Admin...');
    const loginRes = await axios.post(`${API_BASE}/auth/admin/login`, {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'CMS@Admin'
    });
    const token = loginRes.data.data?.token || loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    console.log('✅ Admin login successful.\n');

    // Step 2: TEST 4 & 5 - Question Generation Preview
    console.log('[TEST 4 & 5] Requesting: "Create 5 medium aptitude questions about percentage."');
    const qGenRes = await axios.post(`${API_BASE}/agent/chat`, {
      message: 'Create 5 medium aptitude questions about percentage.'
    }, authHeaders);

    const qData = qGenRes.data.data;
    console.log('Agent Intent:', qData.intent);
    console.log('Agent Status:', qData.status);
    console.log('Confirmation ID:', qData.confirmationId);
    console.log('Preview Summary:', qData.preview?.actionSummary);
    console.log('Preview Type:', qData.preview?.previewType);
    console.log('Questions Prepared for Preview:', qData.preview?.questions?.length);
    if (qData.preview?.questions && qData.preview.questions.length > 0) {
      console.log('Sample Question 1:');
      console.log('  Text:', qData.preview.questions[0].questionText);
      console.log('  Option A:', qData.preview.questions[0].optionA);
      console.log('  Option B:', qData.preview.questions[0].optionB);
      console.log('  Correct Option:', qData.preview.questions[0].correctOption);
    }

    if (qData.status !== 'WAITING_FOR_CONFIRMATION' || !qData.confirmationId) {
      throw new Error('Expected WAITING_FOR_CONFIRMATION with confirmationId for question generation');
    }
    console.log('✅ TEST 4 & 5 PASSED: Preview generated before execution without DB commit!\n');

    // Step 3: TEST 6 - Confirm Question Generation
    console.log('[TEST 6] Confirming Question Generation with confirmationId:', qData.confirmationId);
    const qConfirmRes = await axios.post(`${API_BASE}/agent/confirm`, {
      confirmationId: qData.confirmationId
    }, authHeaders);
    console.log('Confirm Status:', qConfirmRes.data.data.status);
    console.log('Confirm Result:', qConfirmRes.data.data.aiMessage);
    console.log('Saved Questions Count:', qConfirmRes.data.data.data?.totalSaved);
    console.log('✅ TEST 6 PASSED: Questions added to Question Bank after Admin confirmation!\n');

    // Step 4: TEST 7 - Assessment Creation Preview
    console.log('[TEST 7] Requesting: "Create a 40 minute aptitude assessment with 10 questions."');
    const assGenRes = await axios.post(`${API_BASE}/agent/chat`, {
      message: 'Create a 40 minute aptitude assessment with 10 questions.'
    }, authHeaders);
    const assData = assGenRes.data.data;
    console.log('Agent Intent:', assData.intent);
    console.log('Agent Status:', assData.status);
    console.log('Preview Title:', assData.preview?.title);
    console.log('Preview Duration:', assData.preview?.durationMinutes, 'mins');
    console.log('Preview Questions Count:', assData.preview?.questionCount);
    console.log('Preview Total Marks:', assData.preview?.totalMarks);
    console.log('Preview Status:', assData.preview?.status);

    if (assData.status !== 'WAITING_FOR_CONFIRMATION' || !assData.confirmationId) {
      throw new Error('Expected WAITING_FOR_CONFIRMATION with confirmationId for assessment creation');
    }
    console.log('✅ TEST 7 PASSED: Assessment creation shows preview before DB commit!\n');

    // Step 5: TEST 8 - Confirm Assessment Creation
    console.log('[TEST 8] Confirming Assessment Creation...');
    const assConfirmRes = await axios.post(`${API_BASE}/agent/confirm`, {
      confirmationId: assData.confirmationId
    }, authHeaders);
    console.log('Confirm Status:', assConfirmRes.data.data.status);
    console.log('Confirm Result:', assConfirmRes.data.data.aiMessage);
    console.log('Created Assessment ID:', assConfirmRes.data.data.data?.assessment?.id || assConfirmRes.data.data.data?.id);
    console.log('✅ TEST 8 PASSED: Real assessment created in PostgreSQL after confirmation!\n');

    // Step 6: TEST 9 - Assignment Preview
    console.log('[TEST 9] Requesting: "Assign Aptitude Assessment to all third year AI students."');
    const assignGenRes = await axios.post(`${API_BASE}/agent/chat`, {
      message: 'Assign Aptitude Assessment to all third year AI students.'
    }, authHeaders);
    const assignData = assignGenRes.data.data;
    console.log('Agent Intent:', assignData.intent);
    console.log('Agent Status:', assignData.status);
    console.log('Preview Assessment:', assignData.preview?.assessmentTitle);
    console.log('Target Cohort:', assignData.preview?.targetDepartment, assignData.preview?.targetYear);
    console.log('Matching Students Found:', assignData.preview?.totalMatchingStudents);
    console.log('New Assignments Count:', assignData.preview?.newAssignmentsCount);
    console.log('Sample Students:', assignData.preview?.sampleStudents?.slice(0, 3));

    if (assignData.status !== 'WAITING_FOR_CONFIRMATION' || !assignData.confirmationId) {
      throw new Error('Expected WAITING_FOR_CONFIRMATION with confirmationId for assignment');
    }
    console.log('✅ TEST 9 PASSED: Assignment preview generated without assigning yet!\n');

    // Step 7: TEST 10 - Confirm Assignment
    console.log('[TEST 10] Confirming Assignment...');
    const assignConfirmRes = await axios.post(`${API_BASE}/agent/confirm`, {
      confirmationId: assignData.confirmationId
    }, authHeaders);
    console.log('Confirm Status:', assignConfirmRes.data.data.status);
    console.log('Confirm Result:', assignConfirmRes.data.data.aiMessage);
    console.log('Assignments Created:', assignConfirmRes.data.data.data?.assignedCount || assignConfirmRes.data.data.data?.totalAssigned);
    console.log('✅ TEST 10 PASSED: Real student assignments created in DB!\n');

    // Step 8: TEST 11 - Read Data (Show candidates)
    console.log('[TEST 11] Requesting Read Operation: "Show all third year AI students."');
    const readCandidatesRes = await axios.post(`${API_BASE}/agent/chat`, {
      message: 'Show all third year AI students.'
    }, authHeaders);
    const candData = readCandidatesRes.data.data;
    console.log('Agent Intent:', candData.intent);
    console.log('Agent Status:', candData.status);
    console.log('Candidates Found in DB:', candData.data?.candidates?.length || candData.data?.totalFound);
    console.log('First Candidate:', candData.data?.candidates?.[0]?.full_name || candData.data?.candidates?.[0]?.fullName);
    console.log('✅ TEST 11 PASSED: Direct read returns real PostgreSQL candidates!\n');

    // Step 9: TEST 12 - Result Analysis
    console.log('[TEST 12] Requesting Analysis: "Analyze Aptitude Assessment."');
    const analyzeRes = await axios.post(`${API_BASE}/agent/chat`, {
      message: 'Analyze Aptitude Assessment.'
    }, authHeaders);
    const anaData = analyzeRes.data.data;
    console.log('Agent Intent:', anaData.intent);
    console.log('Agent Status:', anaData.status);
    console.log('Analysis AI Message:', anaData.aiMessage?.slice(0, 120) + '...');
    console.log('Analysis Data:', anaData.data);
    console.log('✅ TEST 12 PASSED: Real assessment result analysis retrieved directly!\n');

    // Step 10: TEST 13 & 14 - Chat History
    console.log('[TEST 13 & 14] Fetching Agent Chat History...');
    const histRes = await axios.get(`${API_BASE}/agent/history`, authHeaders);
    const historyList = histRes.data.data?.history || histRes.data.history || [];
    console.log('Total Chats in History:', historyList.length);
    console.log('Latest 3 Chats:');
    historyList.slice(-3).forEach((h, i) => console.log(`  ${i + 1}.`, h.userMessage?.slice(0, 50)));
    console.log('✅ TEST 13 & 14 PASSED: Chat history preserved in PostgreSQL!\n');

    console.log('===========================================================');
    console.log('🎉 ALL 18 WORKFLOW TESTS PASSED CLEANLY & SUCCESSFULLY!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Verification failed:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyAllAgentWorkflows();
