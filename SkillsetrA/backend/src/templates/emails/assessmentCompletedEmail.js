/**
 * SkillsetrA Assessment Completed Email Template
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

function generateAssessmentCompletedEmail({
  studentName,
  assessmentTitle,
  score,
  totalMarks,
  percentage,
  correctAnswers,
  wrongAnswers,
  unanswered,
  completedAt
}) {
  const safeName = escapeHtml(studentName || 'Student');
  const safeTitle = escapeHtml(assessmentTitle || 'Assessment');
  const safeScore = escapeHtml(score != null ? String(score) : '0');
  const safeTotalMarks = escapeHtml(totalMarks != null ? String(totalMarks) : '0');
  const safePercentage = escapeHtml(percentage != null ? String(percentage) : '0');
  const safeCorrect = escapeHtml(correctAnswers != null ? String(correctAnswers) : '0');
  const safeWrong = escapeHtml(wrongAnswers != null ? String(wrongAnswers) : '0');
  const safeUnanswered = escapeHtml(unanswered != null ? String(unanswered) : '0');
  const safeCompletedAt = escapeHtml(completedAt || new Date().toLocaleString());

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkillsetrA - Assessment Completed</title>
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
              <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 14px;">Campus Placement & Assessment Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Hello ${safeName},</h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
                Your SkillsetrA assessment has been completed successfully.
              </p>

              <!-- Score Highlight Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 20px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase;">Assessment Score</p>
                    <p style="margin: 0; font-size: 28px; font-weight: 800; color: #15803d;">${safeScore} / ${safeTotalMarks}</p>
                    <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: #166534;">${safePercentage}%</p>
                  </td>
                </tr>
              </table>

              <!-- Detailed Score Breakdown -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 45%; font-weight: 600;">Assessment:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 700;">${safeTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Score:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeScore} / ${safeTotalMarks}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Percentage:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safePercentage}%</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #15803d; font-weight: 600;">Correct Answers:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #15803d; font-weight: 700;">${safeCorrect}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #b91c1c; font-weight: 600;">Wrong Answers:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #b91c1c; font-weight: 700;">${safeWrong}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Unanswered:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeUnanswered}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #64748b; font-weight: 600;">Completed At:</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">${safeCompletedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">
                You can login to SkillsetrA to view your detailed result and answer report.
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
                This is an automated performance report from SkillsetrA.
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

Your SkillsetrA assessment has been completed successfully.

Assessment:
${assessmentTitle || 'Assessment'}

Score:
${score != null ? score : 0} / ${totalMarks != null ? totalMarks : 0}

Percentage:
${percentage != null ? percentage : 0}%

Correct Answers:
${correctAnswers != null ? correctAnswers : 0}

Wrong Answers:
${wrongAnswers != null ? wrongAnswers : 0}

Unanswered:
${unanswered != null ? unanswered : 0}

Completed At:
${completedAt || new Date().toLocaleString()}

You can login to SkillsetrA to view your detailed result and answer report.

Regards,
SkillsetrA Team
  `.trim();

  return {
    subject: 'SkillsetrA - Assessment Completed',
    html,
    text
  };
}

module.exports = {
  generateAssessmentCompletedEmail
};
