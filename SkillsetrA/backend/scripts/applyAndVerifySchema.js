// backend/scripts/applyAndVerifySchema.js
// Executes database/schema.sql and verifies all 11 tables, constraints, and indexes

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('🔄 Applying schema.sql to PostgreSQL database "skillsetra"...');
  const sqlPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    // 1. Execute full DDL
    await client.query(sql);
    console.log('✅ schema.sql executed successfully.\n');

    // 2. Verify all 11 tables
    const expectedTables = [
      'users',
      'students',
      'questions',
      'assessments',
      'assessment_questions',
      'assessment_assignments',
      'attempts',
      'attempt_questions',
      'answers',
      'results',
      'activity_logs',
    ];

    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = tableRes.rows.map(r => r.table_name);
    console.log('📊 Existing Database Tables in "skillsetra":');
    expectedTables.forEach(tbl => {
      const found = existingTables.includes(tbl);
      console.log(`  ${found ? '✅' : '❌'} ${tbl}`);
    });

    // 3. Verify Foreign Keys
    const fkRes = await client.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    console.log(`\n🔗 Verified ${fkRes.rows.length} Foreign Key Constraints.`);

    // 4. Verify Indexes
    const idxRes = await client.query(`TASK: Add ONLY an Excel Bulk Candidate Registration option to the existing SkillsetrA application.

VERY IMPORTANT:
DO NOT CHANGE THE EXISTING APPLICATION.
DO NOT redesign any existing page.
DO NOT change existing models.
DO NOT change database schema.
DO NOT change existing tables or relationships.
DO NOT change JWT authentication.
DO NOT change login.
DO NOT change existing password hashing.
DO NOT change existing APIs or existing workflows unless absolutely required for this feature.
DO NOT change Question Bank, Assessment Management, Assignment Management, Exam, Timer, Auto Submit, Results, Dashboard, Monitoring, or Student Profile.
DO NOT remove or break the existing manual candidate registration.

First inspect the existing application and understand the current User model, Student model, registration API, password handling, authentication, and Admin Register Candidate page.

==================================================
REQUIRED FEATURE
==================================================

Add a BULK EXCEL IMPORT option to the existing Admin → Register Candidate area.

The existing application should continue working exactly as it does now.

New flow:

Admin
→ Existing Register Candidate page
→ Bulk Excel Import option
→ Upload Excel
→ Enter ONE common initial password
→ Validate Excel
→ Preview candidates
→ Confirm
→ Register valid candidates using the EXISTING registration logic

==================================================
EXCEL
==================================================

Use ONLY fields that already exist in the current Student/User models.

Do NOT create new model fields.

Typical Excel columns may be:

Register Number
Full Name
Email
Department
Year
Section
Phone

BUT FIRST inspect the existing models.

If one of these fields does not exist, do not add it to the database.

Create the Excel template according to the EXISTING model fields.

Password must NOT be included in the Excel file.

==================================================
COMMON INITIAL PASSWORD
==================================================

Admin enters one password during Excel import:

Initial Password
[ *************** ] 👁

This password is used for all NEW students imported from that Excel file.

Use the EXISTING password field and EXISTING password hashing logic.

NEVER store plaintext passwords.

NEVER display passwords in API responses.

NEVER log passwords.

DO NOT create a new password field.

==================================================
EXCEL VALIDATION
==================================================

After Excel upload:

DO NOT immediately create students.

Validate first:

- Required existing fields
- Empty rows
- Invalid email
- Duplicate register number
- Duplicate email
- Already registered candidates
- Invalid data

Show a preview:

Total Rows: 100
Valid: 96
Invalid: 2
Already Registered: 2

Show each row's status.

==================================================
CONFIRM REGISTRATION
==================================================

Only after Admin clicks:

[ Confirm Registration ]

create the valid candidates.

Use the EXISTING student registration service/API/model.

Do NOT create a separate duplicate registration system.

Existing manual registration must continue working.

If an existing student is found:

- Do NOT overwrite
- Do NOT reset their password
- Do NOT modify their existing profile

==================================================
PASSWORD CHANGE
==================================================

After students receive the common initial password, they should change their password using the EXISTING password/profile functionality.

FIRST inspect the current application.

If an existing Change Password / Update Password feature exists, reuse it.

Do NOT create a new database field.

Do NOT create a new model.

Do NOT modify existing models.

Do NOT create a second authentication system.

If the current application does not support the requested password-change behavior, DO NOT change the model.

Instead, report the limitation before making any schema/model change.

==================================================
ADMIN UI
==================================================

Keep the existing Admin Register Candidate page and design.

Add only a small bulk-import option.

Example:

Register Candidate

[ Existing Manual Registration ]

[ Bulk Excel Import ]

Bulk Excel Import:

[ Choose Excel File ]

Initial Password:
[ *************** ] 👁

[ Validate Excel ]

Preview

[ Cancel ] [ Confirm Registration ]

Do not redesign the Admin page.

Do not change existing colors, layout, navigation, or components unnecessarily.

==================================================
SECURITY
==================================================

Use the existing JWT/Admin authentication.

Only authenticated Admin users can import candidates.

Use parameterized database queries.

Use the existing password hashing mechanism.

Never store plaintext passwords.

Never return password hashes.

Never put passwords into logs or activity records.

==================================================
DATABASE / MODELS — ABSOLUTELY NO CHANGES
==================================================

DO NOT:

- Add columns
- Remove columns
- Rename columns
- Change column types
- Add tables
- Remove tables
- Add relationships
- Change existing models
- Change migrations

Reuse everything that already exists.

==================================================
DEPENDENCIES
==================================================

Before installing anything, inspect package.json.

If an Excel parser is not already available, you may install ONE suitable Excel parsing package such as `xlsx`.

Do not install unnecessary packages.

==================================================
TESTING
==================================================

Run everything locally.

Test:

1. Existing manual candidate registration still works.
2. Upload a valid Excel file.
3. Validate Excel.
4. Preview candidates.
5. Confirm registration.
6. Verify candidates appear in the existing Registered Candidates list.
7. Verify all existing model fields are populated correctly.
8. Verify all newly imported students can log in using the common initial password.
9. Verify plaintext passwords are not stored.
10. Verify duplicate students are not overwritten.
11. Verify invalid rows are rejected.
12. Verify existing students and existing login functionality are unaffected.
13. Verify existing application pages still work.

==================================================
STRICT FINAL RULE
==================================================

THIS IS AN ADDITIVE FEATURE ONLY.

Do not rewrite the existing application.

Do not refactor unrelated code.

Do not modify existing models.

Do not modify database schema.

Do not modify existing authentication.

Do not modify existing UI except the minimum required addition to the Register Candidate area.

Do not deploy.

After implementation, report only:

1. Files changed
2. New Excel import functionality
3. Existing models reused
4. Existing APIs reused/any new API added
5. Dependencies added, if any
6. Local test result
7. Any limitation

If any requested functionality requires changing an existing model or database schema, STOP and report it instead of changing it.TASK: Add ONLY an Excel Bulk Candidate Registration option to the existing SkillsetrA application.

VERY IMPORTANT:
DO NOT CHANGE THE EXISTING APPLICATION.
DO NOT redesign any existing page.
DO NOT change existing models.
DO NOT change database schema.
DO NOT change existing tables or relationships.
DO NOT change JWT authentication.
DO NOT change login.
DO NOT change existing password hashing.
DO NOT change existing APIs or existing workflows unless absolutely required for this feature.
DO NOT change Question Bank, Assessment Management, Assignment Management, Exam, Timer, Auto Submit, Results, Dashboard, Monitoring, or Student Profile.
DO NOT remove or break the existing manual candidate registration.

First inspect the existing application and understand the current User model, Student model, registration API, password handling, authentication, and Admin Register Candidate page.

==================================================
REQUIRED FEATURE
==================================================

Add a BULK EXCEL IMPORT option to the existing Admin → Register Candidate area.

The existing application should continue working exactly as it does now.

New flow:

Admin
→ Existing Register Candidate page
→ Bulk Excel Import option
→ Upload Excel
→ Enter ONE common initial password
→ Validate Excel
→ Preview candidates
→ Confirm
→ Register valid candidates using the EXISTING registration logic

==================================================
EXCEL
==================================================

Use ONLY fields that already exist in the current Student/User models.

Do NOT create new model fields.

Typical Excel columns may be:

Register Number
Full Name
Email
Department
Year
Section
Phone

BUT FIRST inspect the existing models.

If one of these fields does not exist, do not add it to the database.

Create the Excel template according to the EXISTING model fields.

Password must NOT be included in the Excel file.

==================================================
COMMON INITIAL PASSWORD
==================================================

Admin enters one password during Excel import:

Initial Password
[ *************** ] 👁

This password is used for all NEW students imported from that Excel file.

Use the EXISTING password field and EXISTING password hashing logic.

NEVER store plaintext passwords.

NEVER display passwords in API responses.

NEVER log passwords.

DO NOT create a new password field.

==================================================
EXCEL VALIDATION
==================================================

After Excel upload:

DO NOT immediately create students.

Validate first:

- Required existing fields
- Empty rows
- Invalid email
- Duplicate register number
- Duplicate email
- Already registered candidates
- Invalid data

Show a preview:

Total Rows: 100
Valid: 96
Invalid: 2
Already Registered: 2

Show each row's status.

==================================================
CONFIRM REGISTRATION
==================================================

Only after Admin clicks:

[ Confirm Registration ]

create the valid candidates.

Use the EXISTING student registration service/API/model.

Do NOT create a separate duplicate registration system.

Existing manual registration must continue working.

If an existing student is found:

- Do NOT overwrite
- Do NOT reset their password
- Do NOT modify their existing profile

==================================================
PASSWORD CHANGE
==================================================

After students receive the common initial password, they should change their password using the EXISTING password/profile functionality.

FIRST inspect the current application.

If an existing Change Password / Update Password feature exists, reuse it.

Do NOT create a new database field.

Do NOT create a new model.

Do NOT modify existing models.

Do NOT create a second authentication system.

If the current application does not support the requested password-change behavior, DO NOT change the model.

Instead, report the limitation before making any schema/model change.

==================================================
ADMIN UI
==================================================

Keep the existing Admin Register Candidate page and design.

Add only a small bulk-import option.

Example:

Register Candidate

[ Existing Manual Registration ]

[ Bulk Excel Import ]

Bulk Excel Import:

[ Choose Excel File ]

Initial Password:
[ *************** ] 👁

[ Validate Excel ]

Preview

[ Cancel ] [ Confirm Registration ]

Do not redesign the Admin page.

Do not change existing colors, layout, navigation, or components unnecessarily.

==================================================
SECURITY
==================================================

Use the existing JWT/Admin authentication.

Only authenticated Admin users can import candidates.

Use parameterized database queries.

Use the existing password hashing mechanism.

Never store plaintext passwords.

Never return password hashes.

Never put passwords into logs or activity records.

==================================================
DATABASE / MODELS — ABSOLUTELY NO CHANGES
==================================================

DO NOT:

- Add columns
- Remove columns
- Rename columns
- Change column types
- Add tables
- Remove tables
- Add relationships
- Change existing models
- Change migrations

Reuse everything that already exists.

==================================================
DEPENDENCIES
==================================================

Before installing anything, inspect package.json.

If an Excel parser is not already available, you may install ONE suitable Excel parsing package such as `xlsx`.

Do not install unnecessary packages.

==================================================
TESTING
==================================================

Run everything locally.

Test:

1. Existing manual candidate registration still works.
2. Upload a valid Excel file.
3. Validate Excel.
4. Preview candidates.
5. Confirm registration.
6. Verify candidates appear in the existing Registered Candidates list.
7. Verify all existing model fields are populated correctly.
8. Verify all newly imported students can log in using the common initial password.
9. Verify plaintext passwords are not stored.
10. Verify duplicate students are not overwritten.
11. Verify invalid rows are rejected.
12. Verify existing students and existing login functionality are unaffected.
13. Verify existing application pages still work.

==================================================
STRICT FINAL RULE
==================================================

THIS IS AN ADDITIVE FEATURE ONLY.

Do not rewrite the existing application.

Do not refactor unrelated code.

Do not modify existing models.

Do not modify database schema.

Do not modify existing authentication.

Do not modify existing UI except the minimum required addition to the Register Candidate area.

Do not deploy.

After implementation, report only:

1. Files changed
2. New Excel import functionality
3. Existing models reused
4. Existing APIs reused/any new API added
5. Dependencies added, if any
6. Local test result
7. Any limitation

If any requested functionality requires changing an existing model or database schema, STOP and report it instead of changing it.
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.log(`⚡ Verified ${idxRes.rows.length} Indexes across all tables.`);

    console.log('\n🎉 Step 8 Database Schema Verification Complete: 100% Success!');
  } catch (err) {
    console.error('❌ Error executing schema.sql:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
