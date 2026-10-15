/**
 * SkillsetrA Student Welcome Email Template
 * Responsive HTML + Plain Text email template for student onboarding.
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

function generateStudentWelcomeEmail({ studentName, registerNumber, username, initialPassword, loginUrl }) {
  const safeStudentName = escapeHtml(studentName || 'Student');
  const safeRegisterNumber = escapeHtml(registerNumber || 'N/A');
  const safeUsername = escapeHtml(username || safeRegisterNumber);
  const safeInitialPassword = initialPassword ? escapeHtml(initialPassword) : null;
  const safeLoginUrl = loginUrl || 'http://localhost:5173/login';

  const passwordSectionHtml = safeInitialPassword
    ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Initial Password</p>
        <p style="margin: 0; font-family: monospace; font-size: 16px; font-weight: 700; color: #1e293b;">${safeInitialPassword}</p>
        <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">For security reasons, we recommend updating your password after your first login.</p>
      </div>
    `
    : `
      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #475569;">Use the credentials provided by your campus placement administrator to sign in.</p>
      </div>
    `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SkillsetrA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">SkillsetrA</h1>
              <p style="margin: 6px 0 0 0; color: #c7d2fe; font-size: 14px; font-weight: 500;">Campus Placement & Assessment Platform</p>
            </td>
          </tr>
          
          <!-- Main Body -->
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">Welcome, ${safeStudentName}!</h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
                Your student account has been successfully created on the <strong>SkillsetrA</strong> assessment platform. You can now access all scheduled campus placement aptitude and verbal assessment modules.
              </p>

              <!-- Account Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 40%; font-weight: 600;">Register Number:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${safeRegisterNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Username:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${safeUsername}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${passwordSectionHtml}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeLoginUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);">
                      Log In to SkillsetrA
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${safeLoginUrl}" style="color: #4f46e5; word-break: break-all;">${safeLoginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                SkillsetrA Placement Assessment System &bull; Automated Notification
              </p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">
                Please do not reply directly to this automated email. For assistance, contact your placement administrator.
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
Welcome to SkillsetrA, ${safeStudentName}!

Your SkillsetrA student account has been created for campus placement and aptitude assessments.

Account Details:
- Register Number: ${safeRegisterNumber}
- Username: ${safeUsername}
${initialPassword ? `- Initial Password: ${initialPassword}\n(Please update your password upon first login)` : ''}

Login URL: ${safeLoginUrl}

Please keep your login credentials secure.

Regards,
SkillsetrA Team
  `.trim();

  return {
    subject: 'Welcome to SkillsetrA – Your Student Account',
    html,
    text
  };
}

module.exports = {
  generateStudentWelcomeEmail
};
