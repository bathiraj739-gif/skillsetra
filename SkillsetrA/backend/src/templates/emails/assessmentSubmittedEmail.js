/**
 * SkillsetrA Assessment Submitted Email Template
 */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateAssessmentSubmittedEmail({ studentName, assessmentTitle, submissionStatus, submittedAt }) {
  const safeName = escapeHtml(studentName || 'Student');
  const safeTitle = escapeHtml(assessmentTitle || 'Assessment');
  const safeStatus = escapeHtml(submissionStatus || 'Submitted');
  const safeSubmittedAt = escapeHtml(submittedAt || new Date().toLocaleString());

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkillsetrA - Assessment Submitted Successfully</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SkillsetrA</h1>
              <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 14px;">Online Aptitude & Verbal Assessment Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Hello ${safeName},</h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
                Your assessment has been submitted successfully.
              </p>

              <!-- Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 40%; font-weight: 600;">Assessment:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${safeTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Submission Status:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeStatus}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Submitted At:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeSubmittedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                You can login to SkillsetrA to view your result.
              </p>

              <p style="margin: 25px 0 0 0; font-size: 14px; color: #334155;">
                Regards,<br>
                <strong>SkillsetrA Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This is an automated notification from SkillsetrA.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hello ${studentName || 'Student'},

Your assessment has been submitted successfully.

Assessment:
${assessmentTitle || 'Assessment'}

Submission Status:
${submissionStatus || 'Submitted'}

Submitted At:
${submittedAt || new Date().toLocaleString()}

You can login to SkillsetrA to view your result.

Regards,
SkillsetrA Team
  `.trim();

  return {
    subject: 'SkillsetrA - Assessment Submitted Successfully',
    html,
    text
  };
}

module.exports = {
  generateAssessmentSubmittedEmail
};
