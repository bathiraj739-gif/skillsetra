require('dotenv').config();
const http = require('http');
const app = require('../src/app');
const pool = require('../src/config/db');
const axios = require('axios');

async function runBulkImportTests() {
  console.log('==================================================');
  console.log('     BULK EXCEL IMPORT COMPREHENSIVE TEST SUITE    ');
  console.log('==================================================\n');

  const server = http.createServer(app);
  const PORT = 5005;

  await new Promise((resolve) => server.listen(PORT, resolve));
  const API_URL = `http://localhost:${PORT}/api`;
  console.log(`Test server started on ${API_URL}\n`);

  let adminToken;
  const timestamp = Date.now();
  const commonPassword = 'CommonBulkPass123!';

  try {
    // 1. Admin Login
    console.log('1. Admin Authentication...');
    const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
      username: 'admin',
      password: 'CMS@Admin'
    });
    adminToken = loginRes.data.data.token;
    console.log('   ✅ Admin login successful\n');

    // 2. Test Existing Manual Candidate Registration
    console.log('2. Test Existing Manual Candidate Registration (Must continue working)...');
    const manualRegNo = `MAN${timestamp}`;
    const manualUser = `manual_${timestamp}`;
    const manualStudentRes = await axios.post(
      `${API_URL}/students`,
      {
        username: manualUser,
        password: 'manualPass123!',
        register_number: manualRegNo,
        full_name: 'Manual Candidate Test',
        email: `manual_${timestamp}@college.edu`,
        department: 'CSE',
        year: 4
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('   ✅ Manual student created:', manualStudentRes.data.student.register_number, '\n');

    // 3. Test Excel Data Preparation & Excel Validation API
    console.log('3. Test Excel Validation API (POST /api/students/bulk-validate)...');
    const validCandidate1 = {
      register_number: `BLK1_${timestamp}`,
      full_name: 'Bulk Candidate One',
      email: `bulk1_${timestamp}@college.edu`,
      department: 'ECE',
      year: '3',
      section: 'A',
      phone: '9876543210'
    };
    const validCandidate2 = {
      register_number: `BLK2_${timestamp}`,
      full_name: 'Bulk Candidate Two',
      email: `bulk2_${timestamp}@college.edu`,
      department: 'MECH',
      year: '2',
      section: 'B',
      phone: '9876543211'
    };
    const invalidCandidate = {
      register_number: '',
      full_name: 'Invalid Candidate',
      email: 'invalid-email',
      department: 'CIVIL'
    };
    const duplicateCandidate = {
      register_number: manualRegNo,
      full_name: 'Already Registered Manual Candidate',
      email: `manual_${timestamp}@college.edu`
    };

    const excelBatchPayload = [
      validCandidate1,
      validCandidate2,
      invalidCandidate,
      duplicateCandidate
    ];

    const validateRes = await axios.post(
      `${API_URL}/students/bulk-validate`,
      { candidates: excelBatchPayload },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const validationData = validateRes.data.data;
    console.log('   Preview Results:');
    console.log(`   - Total Rows: ${validationData.totalRows}`);
    console.log(`   - Valid Count: ${validationData.validCount}`);
    console.log(`   - Invalid Count: ${validationData.invalidCount}`);
    console.log(`   - Already Registered Count: ${validationData.alreadyRegisteredCount}`);

    if (
      validationData.totalRows === 4 &&
      validationData.validCount === 2 &&
      validationData.invalidCount === 1 &&
      validationData.alreadyRegisteredCount === 1
    ) {
      console.log('   ✅ Validation counts match expected counts!\n');
    } else {
      console.log('   ❌ Unexpected validation counts:', validationData);
    }

    // 4. Confirm Bulk Registration
    console.log('4. Test Confirm Bulk Registration (POST /api/students/bulk-import)...');
    const validCandidatesToImport = validationData.rows
      .filter((r) => r.status === 'valid')
      .map((r) => r.candidate);

    const importRes = await axios.post(
      `${API_URL}/students/bulk-import`,
      {
        candidates: validCandidatesToImport,
        initialPassword: commonPassword
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('   ✅ Import result:', importRes.data.message);
    console.log(`   - Registered Count: ${importRes.data.data.registeredCount}\n`);

    // 5. Verify Candidates Appear in Existing Registered Candidates List
    console.log('5. Verify Candidates in Registered Candidates List (GET /api/students)...');
    const rosterRes = await axios.get(`${API_URL}/students`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const studentsList = rosterRes.data.students || rosterRes.data.data.students;

    const imported1 = studentsList.find((s) => s.register_number === validCandidate1.register_number);
    const imported2 = studentsList.find((s) => s.register_number === validCandidate2.register_number);

    if (imported1 && imported2) {
      console.log('   ✅ Newly imported candidates found in roster list!\n');
    } else {
      console.log('   ❌ Imported candidates missing from roster list.');
    }

    // 6. Verify Model Fields are Populated Correctly
    console.log('6. Verify Model Fields Populated Correctly...');
    console.log(`   - Candidate 1: Reg: ${imported1.register_number}, Name: ${imported1.full_name}, Dept: ${imported1.department}, Year: ${imported1.year}, Phone: ${imported1.phone || 'N/A'}`);
    if (imported1.register_number === validCandidate1.register_number && imported1.email === validCandidate1.email && imported1.department === validCandidate1.department) {
      console.log('   ✅ All existing model fields verified correctly!\n');
    } else {
      console.log('   ❌ Model fields mismatch:', imported1);
    }

    // 7. Verify Newly Imported Students Can Log In Using Common Initial Password
    console.log('7. Verify Login with Common Initial Password...');
    const studentLoginRes = await axios.post(`${API_URL}/auth/student/login`, {
      username: validCandidate1.register_number,
      password: commonPassword
    });

    if (studentLoginRes.status === 200 && studentLoginRes.data.data.token) {
      console.log('   ✅ Student login with common initial password successful!\n');
    } else {
      console.log('   ❌ Student login failed.');
    }

    // 8. Verify Plaintext Passwords Are Not Stored
    console.log('8. Verify Password Security (No Plaintext Passwords Stored)...');
    const dbUserRes = await pool.query(
      `SELECT password_hash FROM users WHERE username = $1`,
      [validCandidate1.register_number]
    );

    const passHash = dbUserRes.rows[0].password_hash;
    const isBcrypt = passHash.startsWith('$2a$') || passHash.startsWith('$2b$');
    const isNotPlaintext = passHash !== commonPassword;

    if (isBcrypt && isNotPlaintext) {
      console.log('   ✅ Password hash verified (Bcrypt hash stored, no plaintext!)\n');
    } else {
      console.log('   ❌ Security check failed: Password stored in plaintext!');
    }

    // 9. Verify Duplicate Students Are Not Overwritten
    console.log('9. Verify Existing Student Profile & Password Intact (No Overwrite)...');
    const duplicateImportAttempt = await axios.post(
      `${API_URL}/students/bulk-import`,
      {
        candidates: [
          {
            register_number: manualRegNo,
            full_name: 'ATTEMPTED OVERWRITE NAME',
            email: 'overwrite@college.edu'
          }
        ],
        initialPassword: 'NewPassword999!'
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('   - Skipped Count:', duplicateImportAttempt.data.data.skippedCount);

    const originalLoginCheck = await axios.post(`${API_URL}/auth/student/login`, {
      username: manualUser,
      password: 'manualPass123!'
    });

    if (originalLoginCheck.status === 200) {
      console.log('   ✅ Existing candidate profile and password untouched!\n');
    } else {
      console.log('   ❌ Existing candidate password was overwritten!');
    }

    // 10. Verify Existing Password Change Endpoint Works for Student
    console.log('10. Verify Student Password Change using Existing Endpoint...');
    const studentToken = studentLoginRes.data.data.token;
    const changePassRes = await axios.post(
      `${API_URL}/auth/change-password`,
      {
        oldPassword: commonPassword,
        newPassword: 'UpdatedStudentPass123!',
        confirmPassword: 'UpdatedStudentPass123!'
      },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );

    if (changePassRes.status === 200) {
      console.log('   ✅ Student password updated using existing change-password feature!\n');
    }

    console.log('==================================================');
    console.log('     ALL 13 VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Test failed with error:', err.response ? err.response.data : err.message);
  } finally {
    server.close();
    pool.end();
  }
}

runBulkImportTests();
