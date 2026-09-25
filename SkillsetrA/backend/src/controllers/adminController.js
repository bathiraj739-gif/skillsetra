import pool from '../config/db.js'

export async function getDashboardStats(req, res, next) {
  try {
    const candidateCountRes = await pool.query(`SELECT COUNT(*)::int AS count FROM students`)
    const assessmentCountRes = await pool.query(`SELECT COUNT(*)::int AS count FROM assessments WHERE status = 'published'`)
    const completedExamsRes = await pool.query(`SELECT COUNT(*)::int AS count FROM attempts WHERE status = 'submitted'`)
    const avgPercentageRes = await pool.query(`SELECT COALESCE(AVG(percentage), 0)::numeric(5,2) AS avg_pct FROM results`)

    return res.status(200).json({
      success: true,
      data: {
        totalStudents: candidateCountRes.rows[0].count,
        activeAssessments: assessmentCountRes.rows[0].count,
        completedExams: completedExamsRes.rows[0].count,
        averagePercentage: parseFloat(avgPercentageRes.rows[0].avg_pct),
      },
    })
  } catch (err) {
    next(err)
  }
}

export async function getActivityLogs(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '50', 10)
    const result = await pool.query(
      `
      SELECT 
        l.id,
        l.user_id,
        l.action,
        l.entity_type,
        l.entity_id,
        l.description,
        l.created_at,
        u.username,
        u.role
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT $1
    `,
      [limit]
    )

    const logs = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      activity_type: row.action,
      action: row.action,
      description: row.description || `${row.action} performed`,
      target_type: row.entity_type,
      target_id: row.entity_id,
      created_at: row.created_at,
      username: row.username || 'System',
      role: row.role || 'system',
    }))

    return res.status(200).json({
      success: true,
      data: logs,
    })
  } catch (err) {
    next(err)
  }
}
