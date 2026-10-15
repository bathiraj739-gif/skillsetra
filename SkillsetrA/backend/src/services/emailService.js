const { Resend } = require('resend');
const { generateStudentWelcomeEmail } = require('../templates/emails/studentWelcomeEmail');
const { generateLoginSuccessEmail } = require('../templates/emails/loginSuccessEmail');
const { generateProfileUpdatedEmail } = require('../templates/emails/profileUpdatedEmail');
const { generatePasswordChangedEmail } = require('../templates/emails/passwordChangedEmail');
const { generateAssignmentAssignedEmail } = require('../templates/emails/assignmentAssignedEmail');
const { generateAssignmentViewedEmail } = require('../templates/emails/assignmentViewedEmail');
const { generateAssessmentSubmittedEmail } = require('../templates/emails/assessmentSubmittedEmail');
const { generateAssessmentCompletedEmail } = require('../templates/emails/assessmentCompletedEmail');

// Email configuration
const DEFAULT_SENDER = 'SkillsetrA <onboarding@resend.dev>';
let resendClient = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_placeholder' || apiKey.trim() === '') {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey.trim());
  }
  return resendClient;
}

function getSenderEmail() {
  let sender = process.env.EMAIL_FROM;
  if (!sender || typeof sender !== 'string') {
    return DEFAULT_SENDER;
  }
  sender = sender.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!sender || !sender.includes('@')) {
    return DEFAULT_SENDER;
  }
  return sender;
}

function getReplyToEmail() {
  return process.env.EMAIL_REPLY_TO || undefined;
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function isEmailConfigured() {
  const apiKey = process.env.RESEND_API_KEY;
  return Boolean(apiKey && apiKey !== 're_placeholder' && apiKey.trim() !== '');
}

/**
 * Validate configuration on startup
 */
function validateEmailConfig() {
  if (!isEmailConfigured()) {
    console.warn('[EMAIL SERVICE WARNING] Resend email configuration is missing or using placeholder. Outbound emails will be simulated safely in development.');
    return false;
  }
  const from = getSenderEmail();
  console.log(`[EMAIL SERVICE] Resend email service configured successfully. Default sender: "${from}".`);
  return true;
}

/**
 * Validate standard email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Mask email address for safe, privacy-compliant server logging
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***@***';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***@***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Generic internal email dispatcher with standard error isolation
 */
async function sendGenericEmail({ to, subject, html, text, headers = {}, eventName = 'email', entityId = null }) {
  if (!isValidEmail(to)) {
    return {
      success: false,
      sent: false,
      error: 'Invalid recipient email address'
    };
  }

  const client = getResendClient();
  const maskedRecipient = maskEmail(to);

  if (!client) {
    console.log(`[EMAIL] ${eventName} simulated recipient=${maskedRecipient} status=SIMULATED`);
    return {
      success: true,
      sent: false,
      simulated: true,
      message: 'Email service not configured; email simulated successfully'
    };
  }

  try {
    const sender = getSenderEmail();
    const replyTo = getReplyToEmail();

    const payload = {
      from: sender,
      to: [to.trim()],
      subject,
      html,
      text,
      headers
    };

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    const { data, error } = await client.emails.send(payload);

    if (error) {
      console.error(`[EMAIL] ${eventName} failed recipient=${maskedRecipient} error="${error.message || 'Resend error'}"`);
      return {
        success: false,
        sent: false,
        error: error.message || 'Failed to send email via Resend'
      };
    }

    console.log(`[EMAIL] ${eventName} sent recipient=${maskedRecipient} messageId=${data?.id || 'unknown'}`);
    return {
      success: true,
      sent: true,
      messageId: data?.id,
      recipient: to
    };
  } catch (err) {
    console.error(`[EMAIL] ${eventName} exception recipient=${maskedRecipient} error="${err.message}"`);
    return {
      success: false,
      sent: false,
      error: err.message || `Unexpected error while sending ${eventName}`
    };
  }
}

/**
 * 1. Send Login Success Email
 */
async function sendLoginSuccessEmail({ to, studentName, registerNumber, timestamp, studentId }) {
  const formattedTime = timestamp || new Date().toLocaleString();
  const { subject, html, text } = generateLoginSuccessEmail({
    studentName,
    registerNumber,
    timestamp: formattedTime
  });

  const refKey = studentId || registerNumber || 'auth';
  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: { 'X-Entity-Ref-ID': `login-${refKey}-${Date.now()}` },
    eventName: 'LOGIN_SUCCESS',
    entityId: studentId
  });
}

/**
 * 2. Send Profile Updated Email
 */
async function sendProfileUpdatedEmail({ to, studentName, name, registerNumber, department, year, studentId }) {
  const { subject, html, text } = generateProfileUpdatedEmail({
    studentName: studentName || name,
    name: name || studentName,
    registerNumber,
    department,
    year
  });

  const refKey = studentId || registerNumber || 'profile';
  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: { 'X-Entity-Ref-ID': `profile-${refKey}-${Date.now()}` },
    eventName: 'PROFILE_UPDATED',
    entityId: studentId
  });
}

/**
 * 3. Send Password Changed Email
 */
async function sendPasswordChangedEmail({ to, studentName, timestamp, studentId }) {
  const formattedTime = timestamp || new Date().toLocaleString();
  const { subject, html, text } = generatePasswordChangedEmail({
    studentName,
    timestamp: formattedTime
  });

  const refKey = studentId || 'security';
  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: { 'X-Entity-Ref-ID': `password-${refKey}-${Date.now()}` },
    eventName: 'PASSWORD_CHANGED',
    entityId: studentId
  });
}

/**
 * 4. Send Assignment Assigned Email
 */
async function sendAssignmentAssignedEmail({ to, studentName, assessmentTitle, durationMinutes, assignedAt, studentLoginUrl, assignmentId }) {
  const loginUrl = studentLoginUrl || `${getFrontendUrl()}/login`;
  const formattedDate = assignedAt || new Date().toLocaleString();

  const { subject, html, text } = generateAssignmentAssignedEmail({
    studentName,
    assessmentTitle,
    durationMinutes,
    assignedAt: formattedDate,
    studentLoginUrl: loginUrl
  });

  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: assignmentId ? { 'X-Entity-Ref-ID': `assignment-${assignmentId}` } : {},
    eventName: 'ASSIGNMENT_ASSIGNED',
    entityId: assignmentId
  });
}

/**
 * 5. Send Assignment Viewed Email
 */
async function sendAssignmentViewedEmail({ to, studentName, assessmentTitle, status, assignmentId }) {
  const { subject, html, text } = generateAssignmentViewedEmail({
    studentName,
    assessmentTitle,
    status
  });

  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: assignmentId ? { 'X-Entity-Ref-ID': `assignment-viewed-${assignmentId}` } : { 'X-Entity-Ref-ID': `assignment-viewed-${Date.now()}` },
    eventName: 'ASSIGNMENT_VIEWED',
    entityId: assignmentId
  });
}

/**
 * 6. Send Assessment Submitted Email
 */
async function sendAssessmentSubmittedEmail({ to, studentName, assessmentTitle, submissionStatus, submittedAt, attemptId }) {
  const formattedTime = submittedAt || new Date().toLocaleString();
  const { subject, html, text } = generateAssessmentSubmittedEmail({
    studentName,
    assessmentTitle,
    submissionStatus: submissionStatus || 'Submitted',
    submittedAt: formattedTime
  });

  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: attemptId ? { 'X-Entity-Ref-ID': `submission-${attemptId}` } : { 'X-Entity-Ref-ID': `submission-${Date.now()}` },
    eventName: 'ASSESSMENT_SUBMITTED',
    entityId: attemptId
  });
}

/**
 * 7. Send Assessment Completed Email
 */
async function sendAssessmentCompletedEmail({
  to,
  studentName,
  assessmentTitle,
  score,
  totalMarks,
  percentage,
  correctAnswers,
  wrongAnswers,
  unanswered,
  completedAt,
  attemptId
}) {
  const formattedTime = completedAt || new Date().toLocaleString();
  const { subject, html, text } = generateAssessmentCompletedEmail({
    studentName,
    assessmentTitle,
    score,
    totalMarks,
    percentage,
    correctAnswers,
    wrongAnswers,
    unanswered,
    completedAt: formattedTime
  });

  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: attemptId ? { 'X-Entity-Ref-ID': `completed-${attemptId}` } : { 'X-Entity-Ref-ID': `completed-${Date.now()}` },
    eventName: 'ASSESSMENT_COMPLETED',
    entityId: attemptId
  });
}

/**
 * Send Single Student Welcome Email (reused from existing platform)
 */
async function sendStudentWelcomeEmail({ to, studentName, registerNumber, username, initialPassword, studentId }) {
  if (!isValidEmail(to)) {
    return {
      success: false,
      sent: false,
      error: 'Invalid recipient email address'
    };
  }

  const loginUrl = `${getFrontendUrl()}/login`;
  const { subject, html, text } = generateStudentWelcomeEmail({
    studentName,
    registerNumber,
    username,
    initialPassword,
    loginUrl
  });

  return sendGenericEmail({
    to,
    subject,
    html,
    text,
    headers: studentId ? { 'X-Entity-Ref-ID': `welcome-student-${studentId}` } : {},
    eventName: 'STUDENT_WELCOME',
    entityId: studentId
  });
}

/**
 * Send Bulk Student Welcome Emails with Controlled Concurrency
 */
async function sendBulkStudentWelcomeEmails(studentsWithCredentials, batchSize = 5) {
  if (!Array.isArray(studentsWithCredentials) || studentsWithCredentials.length === 0) {
    return { sentCount: 0, failedCount: 0, results: [] };
  }

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < studentsWithCredentials.length; i += batchSize) {
    const chunk = studentsWithCredentials.slice(i, i + batchSize);
    const promises = chunk.map(async (student) => {
      if (!student.email || !isValidEmail(student.email)) {
        return {
          studentId: student.id,
          registerNumber: student.register_number || student.registerNumber,
          sent: false,
          skipped: true,
          reason: 'No valid email address'
        };
      }

      const res = await sendStudentWelcomeEmail({
        to: student.email,
        studentName: student.full_name || student.name,
        registerNumber: student.register_number || student.registerNumber,
        username: student.username,
        initialPassword: student.initialPassword || student.password,
        studentId: student.id
      });

      return {
        studentId: student.id,
        registerNumber: student.register_number || student.registerNumber,
        email: student.email,
        sent: res.sent,
        simulated: res.simulated,
        messageId: res.messageId,
        error: res.error
      };
    });

    const chunkResults = await Promise.all(promises);
    for (const r of chunkResults) {
      results.push(r);
      if (r.sent || r.simulated) {
        sentCount++;
      } else {
        failedCount++;
      }
    }
  }

  return {
    totalTargeted: studentsWithCredentials.length,
    sentCount,
    failedCount,
    results
  };
}

/**
 * Send Test Email for Admin / Diagnostic Verification
 */
async function sendTestEmail({ to }) {
  if (!isValidEmail(to)) {
    return {
      success: false,
      error: 'A valid recipient email address is required.'
    };
  }

  const client = getResendClient();
  const sender = getSenderEmail();
  const replyTo = getReplyToEmail();
  const maskedRecipient = maskEmail(to);

  if (!client) {
    return {
      success: false,
      error: 'Resend API key is not configured in backend .env (RESEND_API_KEY is missing or placeholder).'
    };
  }

  try {
    const payload = {
      from: sender,
      to: [to.trim()],
      subject: 'SkillsetrA Email Test – Diagnostic Check',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">SkillsetrA Email System Test</h2>
          <p>This is a verified test email from the <strong>SkillsetrA</strong> assessment platform backend via Resend.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 13px; color: #64748b;">
            Timestamp: ${new Date().toISOString()}<br>
            Sender: ${sender}<br>
            Recipient: ${to}
          </p>
        </div>
      `,
      text: `SkillsetrA Email System Test\n\nThis is a verified test email from the SkillsetrA assessment platform backend via Resend.\n\nTimestamp: ${new Date().toISOString()}`
    };

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    const { data, error } = await client.emails.send(payload);

    if (error) {
      console.error(`[EMAIL] TEST_EMAIL failed recipient=${maskedRecipient} error="${error.message || 'Resend error'}"`);
      return {
        success: false,
        error: error.message || 'Resend rejected the test email request'
      };
    }

    console.log(`[EMAIL] TEST_EMAIL sent recipient=${maskedRecipient} messageId=${data?.id || 'unknown'}`);
    return {
      success: true,
      messageId: data?.id,
      recipient: to
    };
  } catch (err) {
    console.error(`[EMAIL] TEST_EMAIL exception recipient=${maskedRecipient} error="${err.message}"`);
    return {
      success: false,
      error: err.message || 'Exception occurred while sending test email'
    };
  }
}

module.exports = {
  getResendClient,
  getSenderEmail,
  getReplyToEmail,
  getFrontendUrl,
  isEmailConfigured,
  validateEmailConfig,
  isValidEmail,
  maskEmail,
  sendLoginSuccessEmail,
  sendProfileUpdatedEmail,
  sendPasswordChangedEmail,
  sendAssignmentAssignedEmail,
  sendAssignmentViewedEmail,
  sendAssessmentSubmittedEmail,
  sendAssessmentCompletedEmail,
  sendStudentWelcomeEmail,
  sendBulkStudentWelcomeEmails,
  sendTestEmail
};
