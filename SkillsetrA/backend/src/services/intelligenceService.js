const pool = require('../config/db');

/**
 * Placement Intelligence Analytics Service
 * High-performance PostgreSQL aggregation queries for campus placement readiness.
 * Avoids N+1 queries and memory-heavy operations.
 */

async function getPlacementOverview() {
  const client = await pool.connect();
  try {
    // 1. Overall assessment and attempt metrics
    const generalRes = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM students) AS total_students,
        (SELECT COUNT(*) FROM assessments WHERE status = 'PUBLISHED') AS published_assessments,
        (SELECT COUNT(*) FROM attempts) AS total_attempts,
        (SELECT COUNT(*) FROM attempts WHERE status IN ('SUBMITTED', 'AUTO_SUBMITTED')) AS completed_attempts,
        (SELECT COUNT(*) FROM attempts WHERE status = 'IN_PROGRESS') AS in_progress_attempts,
        (SELECT COALESCE(AVG(percentage), 0) FROM results) AS avg_percentage,
        (SELECT COALESCE(AVG(score), 0) FROM results) AS avg_score,
        (SELECT COALESCE(MAX(percentage), 0) FROM results) AS max_percentage,
        (SELECT COALESCE(MIN(percentage), 0) FROM results WHERE percentage > 0) AS min_percentage,
        (SELECT COUNT(*) FROM results WHERE percentage >= 50) AS passed_count,
        (SELECT COUNT(*) FROM results) AS total_results
    `);

    const general = generalRes.rows[0];
    const totalAttempts = parseInt(general.total_attempts || 0, 10);
    const completedAttempts = parseInt(general.completed_attempts || 0, 10);
    const totalResults = parseInt(general.total_results || 0, 10);
    const passedCount = parseInt(general.passed_count || 0, 10);

    const completionRate = totalAttempts > 0 
      ? Math.round((completedAttempts / totalAttempts) * 1000) / 10 
      : 0;

    const passRate = totalResults > 0 
      ? Math.round((passedCount / totalResults) * 1000) / 10 
      : 0;

    // 2. Section-wise Performance Aggregations (Aptitude vs Verbal)
    const sectionRes = await client.query(`
      SELECT 
        q.category,
        COUNT(ans.id) AS total_answers,
        COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) AS correct_answers,
        COUNT(CASE WHEN ans.is_correct = FALSE THEN 1 END) AS wrong_answers,
        COALESCE(SUM(ans.marks_awarded), 0) AS total_marks_awarded,
        CASE 
          WHEN COUNT(ans.id) > 0 THEN ROUND((COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100, 1)
          ELSE 0
        END AS accuracy_percentage
      FROM answers ans
      JOIN questions q ON ans.question_id = q.id
      JOIN attempts a ON ans.attempt_id = a.id
      WHERE a.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
      GROUP BY q.category
    `);

    const sections = {
      aptitude: { total_answers: 0, correct: 0, wrong: 0, accuracy: 0, avg_score: 0 },
      verbal: { total_answers: 0, correct: 0, wrong: 0, accuracy: 0, avg_score: 0 }
    };

    sectionRes.rows.forEach(r => {
      const cat = (r.category || '').toLowerCase();
      if (sections[cat]) {
        sections[cat] = {
          total_answers: parseInt(r.total_answers || 0, 10),
          correct: parseInt(r.correct_answers || 0, 10),
          wrong: parseInt(r.wrong_answers || 0, 10),
          accuracy: parseFloat(r.accuracy_percentage || 0),
          total_marks: parseFloat(r.total_marks_awarded || 0)
        };
      }
    });

    // 3. Overall Accuracy across all completed answers
    const totalAnswered = sections.aptitude.total_answers + sections.verbal.total_answers;
    const totalCorrect = sections.aptitude.correct + sections.verbal.correct;
    const overallAccuracy = totalAnswered > 0 
      ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 
      : 0;

    // 4. Difficulty Breakdown
    const diffRes = await client.query(`
      SELECT 
        q.difficulty,
        COUNT(ans.id) AS total_answers,
        COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) AS correct_answers,
        CASE 
          WHEN COUNT(ans.id) > 0 THEN ROUND((COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100, 1)
          ELSE 0
        END AS accuracy_percentage
      FROM answers ans
      JOIN questions q ON ans.question_id = q.id
      JOIN attempts a ON ans.attempt_id = a.id
      WHERE a.status IN ('SUBMITTED', 'AUTO_SUBMITTED')
      GROUP BY q.difficulty
    `);

    const difficultyBreakdown = {
      easy: 0,
      medium: 0,
      hard: 0
    };

    diffRes.rows.forEach(r => {
      const diff = (r.difficulty || '').toLowerCase();
      if (difficultyBreakdown[diff] !== undefined) {
        difficultyBreakdown[diff] = parseFloat(r.accuracy_percentage || 0);
      }
    });

    return {
      total_students: parseInt(general.total_students || 0, 10),
      published_assessments: parseInt(general.published_assessments || 0, 10),
      total_attempts: totalAttempts,
      completed_attempts: completedAttempts,
      in_progress_attempts: parseInt(general.in_progress_attempts || 0, 10),
      completion_rate: completionRate,
      pass_rate: passRate,
      avg_percentage: Math.round(parseFloat(general.avg_percentage || 0) * 10) / 10,
      avg_score: Math.round(parseFloat(general.avg_score || 0) * 10) / 10,
      max_percentage: Math.round(parseFloat(general.max_percentage || 0) * 10) / 10,
      min_percentage: Math.round(parseFloat(general.min_percentage || 0) * 10) / 10,
      overall_accuracy: overallAccuracy,
      sections,
      difficulty_breakdown: difficultyBreakdown
    };
  } finally {
    client.release();
  }
}

const OFFICIAL_DEPARTMENTS = [
  'AI&DS',
  'AI&ML',
  'BME',
  'CSE',
  'CSE(CS)',
  'ECE',
  'EEE',
  'MECH'
];

async function getDepartmentIntelligence() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        COALESCE(s.department, 'Unassigned') AS department,
        COUNT(DISTINCT s.id) AS student_count,
        COUNT(DISTINCT a.id) AS total_attempts,
        COUNT(DISTINCT r.id) AS completed_evaluations,
        COALESCE(ROUND(AVG(r.percentage), 1), 0) AS avg_percentage,
        COALESCE(ROUND(AVG(r.score), 1), 0) AS avg_score,
        COALESCE(ROUND(MAX(r.percentage), 1), 0) AS max_percentage,
        CASE 
          WHEN COUNT(r.id) > 0 THEN ROUND((COUNT(CASE WHEN r.percentage >= 50 THEN 1 END)::numeric / COUNT(r.id)::numeric) * 100, 1)
          ELSE 0
        END AS pass_rate,
        -- Aptitude performance for this department
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS aptitude_accuracy,
        -- Verbal performance for this department
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'VERBAL' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'VERBAL' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS verbal_accuracy
      FROM students s
      LEFT JOIN attempts a ON a.student_id = s.id
      LEFT JOIN results r ON r.attempt_id = a.id
      LEFT JOIN answers ans ON ans.attempt_id = a.id
      LEFT JOIN questions q ON ans.question_id = q.id
      GROUP BY COALESCE(s.department, 'Unassigned')
      ORDER BY student_count DESC, avg_percentage DESC
    `);

    const deptMap = new Map();
    res.rows.forEach(row => {
      deptMap.set(row.department, {
        department: row.department,
        student_count: parseInt(row.student_count || 0, 10),
        total_attempts: parseInt(row.total_attempts || 0, 10),
        completed_evaluations: parseInt(row.completed_evaluations || 0, 10),
        avg_percentage: parseFloat(row.avg_percentage || 0),
        avg_score: parseFloat(row.avg_score || 0),
        max_percentage: parseFloat(row.max_percentage || 0),
        pass_rate: parseFloat(row.pass_rate || 0),
        aptitude_accuracy: parseFloat(row.aptitude_accuracy || 0),
        verbal_accuracy: parseFloat(row.verbal_accuracy || 0),
        completion_rate: parseInt(row.total_attempts || 0, 10) > 0 
          ? Math.round((parseInt(row.completed_evaluations || 0, 10) / parseInt(row.total_attempts || 0, 10)) * 1000) / 10 
          : 0
      });
    });

    // Ensure all 8 official departments are present
    const result = OFFICIAL_DEPARTMENTS.map(deptName => {
      if (deptMap.has(deptName)) {
        return deptMap.get(deptName);
      }
      return {
        department: deptName,
        student_count: 0,
        total_attempts: 0,
        completed_evaluations: 0,
        avg_percentage: 0,
        avg_score: 0,
        max_percentage: 0,
        pass_rate: 0,
        aptitude_accuracy: 0,
        verbal_accuracy: 0,
        completion_rate: 0
      };
    });

    // Also include any other departments if present in the database
    deptMap.forEach((val, key) => {
      if (!OFFICIAL_DEPARTMENTS.includes(key) && key !== 'Unassigned') {
        result.push(val);
      }
    });

    return result;
  } finally {
    client.release();
  }
}

async function getYearIntelligence() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        s.year,
        COUNT(DISTINCT s.id) AS student_count,
        COUNT(DISTINCT a.id) AS total_attempts,
        COUNT(DISTINCT r.id) AS completed_evaluations,
        COALESCE(ROUND(AVG(r.percentage), 1), 0) AS avg_percentage,
        COALESCE(ROUND(AVG(r.score), 1), 0) AS avg_score,
        CASE 
          WHEN COUNT(r.id) > 0 THEN ROUND((COUNT(CASE WHEN r.percentage >= 50 THEN 1 END)::numeric / COUNT(r.id)::numeric) * 100, 1)
          ELSE 0
        END AS pass_rate,
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS aptitude_accuracy,
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'VERBAL' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'VERBAL' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS verbal_accuracy
      FROM students s
      LEFT JOIN attempts a ON a.student_id = s.id
      LEFT JOIN results r ON r.attempt_id = a.id
      LEFT JOIN answers ans ON ans.attempt_id = a.id
      LEFT JOIN questions q ON ans.question_id = q.id
      WHERE s.year IS NOT NULL AND TRIM(s.year) <> ''
      GROUP BY s.year
      ORDER BY s.year ASC
    `);

    return res.rows.map(row => ({
      year: row.year,
      student_count: parseInt(row.student_count || 0, 10),
      total_attempts: parseInt(row.total_attempts || 0, 10),
      completed_evaluations: parseInt(row.completed_evaluations || 0, 10),
      avg_percentage: parseFloat(row.avg_percentage || 0),
      avg_score: parseFloat(row.avg_score || 0),
      pass_rate: parseFloat(row.pass_rate || 0),
      aptitude_accuracy: parseFloat(row.aptitude_accuracy || 0),
      verbal_accuracy: parseFloat(row.verbal_accuracy || 0),
      completion_rate: parseInt(row.total_attempts || 0, 10) > 0 
        ? Math.round((parseInt(row.completed_evaluations || 0, 10) / parseInt(row.total_attempts || 0, 10)) * 1000) / 10 
        : 0
    }));
  } finally {
    client.release();
  }
}

async function getPerformanceTrends() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        ass.id AS assessment_id,
        ass.title AS assessment_title,
        ass.created_at AS assessment_created_at,
        COUNT(r.id) AS completed_participants,
        COALESCE(ROUND(AVG(r.percentage), 1), 0) AS avg_percentage,
        COALESCE(ROUND(AVG(r.score), 1), 0) AS avg_score,
        CASE 
          WHEN COUNT(r.id) > 0 THEN ROUND((COUNT(CASE WHEN r.percentage >= 50 THEN 1 END)::numeric / COUNT(r.id)::numeric) * 100, 1)
          ELSE 0
        END AS pass_rate
      FROM assessments ass
      JOIN results r ON r.assessment_id = ass.id
      GROUP BY ass.id, ass.title, ass.created_at
      ORDER BY ass.created_at ASC
      LIMIT 15
    `);

    return res.rows.map(row => ({
      assessment_id: row.assessment_id,
      title: row.assessment_title,
      date: row.assessment_created_at,
      participants: parseInt(row.completed_participants || 0, 10),
      avg_percentage: parseFloat(row.avg_percentage || 0),
      avg_score: parseFloat(row.avg_score || 0),
      pass_rate: parseFloat(row.pass_rate || 0)
    }));
  } finally {
    client.release();
  }
}

async function getStudentSkillProfiles(limit = 25) {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        s.id AS student_id,
        s.full_name,
        s.register_number,
        s.department,
        s.year,
        COUNT(DISTINCT r.id) AS assessments_completed,
        COALESCE(ROUND(AVG(r.percentage), 1), 0) AS overall_percentage,
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'APTITUDE' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS aptitude_accuracy,
        COALESCE(ROUND(
          (COUNT(CASE WHEN q.category = 'VERBAL' AND ans.is_correct = TRUE THEN 1 END)::numeric / 
           NULLIF(COUNT(CASE WHEN q.category = 'VERBAL' AND ans.id IS NOT NULL THEN 1 END), 0)::numeric) * 100, 1
        ), 0) AS verbal_accuracy
      FROM students s
      JOIN results r ON r.student_id = s.id
      JOIN answers ans ON ans.attempt_id = r.attempt_id
      JOIN questions q ON ans.question_id = q.id
      GROUP BY s.id, s.full_name, s.register_number, s.department, s.year
      HAVING COUNT(DISTINCT r.id) > 0
      ORDER BY overall_percentage DESC, assessments_completed DESC
      LIMIT $1
    `, [Math.min(parseInt(limit, 10) || 25, 100)]);

    return res.rows.map(row => {
      const apt = parseFloat(row.aptitude_accuracy || 0);
      const verb = parseFloat(row.verbal_accuracy || 0);
      let strongSection = 'Balanced';
      let needsImprovement = 'None';

      if (apt > verb + 10) {
        strongSection = 'Aptitude';
        needsImprovement = 'Verbal';
      } else if (verb > apt + 10) {
        strongSection = 'Verbal';
        needsImprovement = 'Aptitude';
      } else if (apt < 50 && verb < 50) {
        strongSection = 'Foundational';
        needsImprovement = 'Both Aptitude & Verbal';
      } else {
        strongSection = 'Aptitude & Verbal';
        needsImprovement = 'High-Difficulty Problem Solving';
      }

      return {
        student_id: row.student_id,
        full_name: row.full_name,
        register_number: row.register_number,
        department: row.department || 'N/A',
        year: row.year || 'N/A',
        assessments_completed: parseInt(row.assessments_completed || 0, 10),
        overall_percentage: parseFloat(row.overall_percentage || 0),
        aptitude_accuracy: apt,
        verbal_accuracy: verb,
        strong_section: strongSection,
        needs_improvement: needsImprovement
      };
    });
  } finally {
    client.release();
  }
}

async function getTopicIntelligence() {
  const client = await pool.connect();
  try {
    // Check if topic column exists in questions table
    const checkCol = await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'topic'
    `);

    if (checkCol.rows.length === 0) {
      return {
        available: false,
        message: 'Topic-level analytics require topic metadata.'
      };
    }

    const topicRes = await client.query(`
      SELECT 
        q.topic,
        q.category,
        COUNT(ans.id) AS total_attempts,
        COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) AS correct_count,
        CASE 
          WHEN COUNT(ans.id) > 0 THEN ROUND((COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100, 1)
          ELSE 0
        END AS accuracy_percentage
      FROM questions q
      JOIN answers ans ON ans.question_id = q.id
      WHERE q.topic IS NOT NULL AND TRIM(q.topic) <> ''
      GROUP BY q.topic, q.category
      HAVING COUNT(ans.id) > 0
      ORDER BY total_attempts DESC, accuracy_percentage DESC
      LIMIT 20
    `);

    if (topicRes.rows.length === 0) {
      return {
        available: false,
        message: 'Topic-level analytics require topic metadata.'
      };
    }

    return {
      available: true,
      topics: topicRes.rows.map(r => ({
        topic: r.topic,
        category: r.category,
        total_attempts: parseInt(r.total_attempts || 0, 10),
        correct_count: parseInt(r.correct_count || 0, 10),
        accuracy_percentage: parseFloat(r.accuracy_percentage || 0)
      }))
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getPlacementOverview,
  getDepartmentIntelligence,
  getYearIntelligence,
  getPerformanceTrends,
  getStudentSkillProfiles,
  getTopicIntelligence
};
