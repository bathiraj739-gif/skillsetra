const pool = require('../config/db');

/**
 * Question Quality Analytics Service
 * Deterministic PostgreSQL aggregation analysis of Question Bank performance.
 * Does not automatically delete or modify questions.
 */

async function getQuestionQualityList(filters = {}) {
  const {
    category = 'ALL',
    difficulty = 'ALL',
    quality = 'ALL',
    search = '',
    page = 1,
    limit = 20,
    sortBy = 'total_attempts',
    sortDir = 'DESC'
  } = filters;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const client = await pool.connect();
  try {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (category && category !== 'ALL') {
      whereConditions.push(`qs.category = $${paramIndex}`);
      queryParams.push(category.toUpperCase());
      paramIndex++;
    }

    if (difficulty && difficulty !== 'ALL') {
      whereConditions.push(`qs.difficulty = $${paramIndex}`);
      queryParams.push(difficulty.toUpperCase());
      paramIndex++;
    }

    if (quality && quality !== 'ALL') {
      whereConditions.push(`qs.quality_indicator = $${paramIndex}`);
      queryParams.push(quality.toUpperCase());
      paramIndex++;
    }

    if (search && search.trim()) {
      whereConditions.push(`qs.question_text ILIKE $${paramIndex}`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate safe sort columns
    const safeSortCols = {
      total_attempts: 'qs.total_attempts',
      accuracy: 'qs.accuracy_percentage',
      answered: 'qs.answered_count',
      correct: 'qs.correct_count',
      created_at: 'qs.created_at',
      quality: 'qs.quality_indicator'
    };
    const sortColumn = safeSortCols[sortBy] || 'qs.total_attempts';
    const direction = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Master CTE with deterministic classification rules
    const masterQuery = `
      WITH question_stats AS (
        SELECT 
          q.id,
          q.question_text,
          q.category,
          q.difficulty,
          q.correct_option,
          q.marks,
          q.is_active,
          q.created_at,
          COUNT(aq.id) AS total_attempts,
          COUNT(ans.id) AS answered_count,
          (COUNT(aq.id) - COUNT(ans.id)) AS unanswered_count,
          COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) AS correct_count,
          COUNT(CASE WHEN ans.is_correct = FALSE THEN 1 END) AS wrong_count,
          CASE 
            WHEN COUNT(ans.id) > 0 THEN ROUND((COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100, 1)
            ELSE 0
          END AS accuracy_percentage,
          COUNT(CASE WHEN ans.selected_option = 'A' THEN 1 END) AS opt_a_count,
          COUNT(CASE WHEN ans.selected_option = 'B' THEN 1 END) AS opt_b_count,
          COUNT(CASE WHEN ans.selected_option = 'C' THEN 1 END) AS opt_c_count,
          COUNT(CASE WHEN ans.selected_option = 'D' THEN 1 END) AS opt_d_count,
          CASE
            WHEN COUNT(aq.id) < 3 THEN 'INSUFFICIENT_DATA'
            WHEN (CASE WHEN COUNT(ans.id) > 0 THEN (COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100 ELSE 0 END) >= 85 THEN 'VERY_EASY'
            WHEN (CASE WHEN COUNT(ans.id) > 0 THEN (COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100 ELSE 0 END) >= 65 THEN 'EASY'
            WHEN (CASE WHEN COUNT(ans.id) > 0 THEN (COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100 ELSE 0 END) >= 40 THEN 'NORMAL'
            WHEN (CASE WHEN COUNT(ans.id) > 0 THEN (COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100 ELSE 0 END) >= 20 THEN 'DIFFICULT'
            ELSE 'VERY_DIFFICULT'
          END AS quality_indicator,
          CASE
            WHEN COUNT(aq.id) >= 5 AND (CASE WHEN COUNT(ans.id) > 0 THEN (COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100 ELSE 0 END) < 25 THEN TRUE
            ELSE FALSE
          END AS flag_high_failure,
          CASE
            WHEN COUNT(aq.id) >= 5 AND ((COUNT(aq.id) - COUNT(ans.id))::numeric / COUNT(aq.id)::numeric) > 0.4 THEN TRUE
            ELSE FALSE
          END AS flag_high_skip,
          CASE
            WHEN COUNT(aq.id) >= 5 AND (COUNT(CASE WHEN ans.is_correct = FALSE THEN 1 END) > COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) * 1.5) THEN TRUE
            ELSE FALSE
          END AS flag_ambiguous
        FROM questions q
        LEFT JOIN attempt_questions aq ON aq.question_id = q.id
        LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = q.id
        GROUP BY q.id
      )
    `;

    // 1. Get filtered total count
    const countRes = await client.query(
      `${masterQuery} SELECT COUNT(*) FROM question_stats qs ${whereClause}`,
      queryParams
    );
    const total = parseInt(countRes.rows[0]?.count || 0, 10);

    // 2. Summary distribution across all active questions
    const summaryRes = await client.query(`
      ${masterQuery}
      SELECT 
        COUNT(*) AS total_questions,
        COUNT(CASE WHEN qs.quality_indicator = 'VERY_EASY' THEN 1 END) AS very_easy_count,
        COUNT(CASE WHEN qs.quality_indicator = 'EASY' THEN 1 END) AS easy_count,
        COUNT(CASE WHEN qs.quality_indicator = 'NORMAL' THEN 1 END) AS normal_count,
        COUNT(CASE WHEN qs.quality_indicator = 'DIFFICULT' THEN 1 END) AS difficult_count,
        COUNT(CASE WHEN qs.quality_indicator = 'VERY_DIFFICULT' THEN 1 END) AS very_difficult_count,
        COUNT(CASE WHEN qs.quality_indicator = 'INSUFFICIENT_DATA' THEN 1 END) AS insufficient_data_count,
        COUNT(CASE WHEN qs.flag_high_failure = TRUE OR qs.flag_high_skip = TRUE OR qs.flag_ambiguous = TRUE THEN 1 END) AS flagged_count
      FROM question_stats qs
    `);

    // 3. Paginated items
    const dataRes = await client.query(
      `${masterQuery} 
       SELECT * FROM question_stats qs 
       ${whereClause} 
       ORDER BY ${sortColumn} ${direction}, qs.id ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, parsedLimit, offset]
    );

    const questions = dataRes.rows.map(r => {
      const answered = parseInt(r.answered_count || 0, 10);
      const totalAtt = parseInt(r.total_attempts || 0, 10);
      const optA = parseInt(r.opt_a_count || 0, 10);
      const optB = parseInt(r.opt_b_count || 0, 10);
      const optC = parseInt(r.opt_c_count || 0, 10);
      const optD = parseInt(r.opt_d_count || 0, 10);

      return {
        id: r.id,
        question_text: r.question_text,
        category: r.category,
        difficulty: r.difficulty,
        correct_option: r.correct_option,
        marks: r.marks,
        is_active: r.is_active,
        created_at: r.created_at,
        total_attempts: totalAtt,
        answered_count: answered,
        unanswered_count: parseInt(r.unanswered_count || 0, 10),
        correct_count: parseInt(r.correct_count || 0, 10),
        wrong_count: parseInt(r.wrong_count || 0, 10),
        accuracy_percentage: parseFloat(r.accuracy_percentage || 0),
        quality_indicator: r.quality_indicator,
        flags: {
          high_failure_rate: r.flag_high_failure,
          high_skip_rate: r.flag_high_skip,
          ambiguous: r.flag_ambiguous,
          insufficient_data: r.quality_indicator === 'INSUFFICIENT_DATA'
        },
        option_distribution: {
          A: { count: optA, percentage: answered > 0 ? Math.round((optA / answered) * 1000) / 10 : 0 },
          B: { count: optB, percentage: answered > 0 ? Math.round((optB / answered) * 1000) / 10 : 0 },
          C: { count: optC, percentage: answered > 0 ? Math.round((optC / answered) * 1000) / 10 : 0 },
          D: { count: optD, percentage: answered > 0 ? Math.round((optD / answered) * 1000) / 10 : 0 }
        }
      };
    });

    return {
      summary: {
        total_questions: parseInt(summaryRes.rows[0]?.total_questions || 0, 10),
        very_easy_count: parseInt(summaryRes.rows[0]?.very_easy_count || 0, 10),
        easy_count: parseInt(summaryRes.rows[0]?.easy_count || 0, 10),
        normal_count: parseInt(summaryRes.rows[0]?.normal_count || 0, 10),
        difficult_count: parseInt(summaryRes.rows[0]?.difficult_count || 0, 10),
        very_difficult_count: parseInt(summaryRes.rows[0]?.very_difficult_count || 0, 10),
        insufficient_data_count: parseInt(summaryRes.rows[0]?.insufficient_data_count || 0, 10),
        flagged_count: parseInt(summaryRes.rows[0]?.flagged_count || 0, 10)
      },
      questions,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit)
      }
    };
  } finally {
    client.release();
  }
}

async function getQuestionDetailedAnalytics(questionId) {
  const client = await pool.connect();
  try {
    const qRes = await client.query(`SELECT * FROM questions WHERE id = $1`, [questionId]);
    if (qRes.rows.length === 0) return null;
    const question = qRes.rows[0];

    const statsRes = await client.query(`
      SELECT 
        COUNT(aq.id) AS total_attempts,
        COUNT(ans.id) AS answered_count,
        (COUNT(aq.id) - COUNT(ans.id)) AS unanswered_count,
        COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END) AS correct_count,
        COUNT(CASE WHEN ans.is_correct = FALSE THEN 1 END) AS wrong_count,
        CASE 
          WHEN COUNT(ans.id) > 0 THEN ROUND((COUNT(CASE WHEN ans.is_correct = TRUE THEN 1 END)::numeric / COUNT(ans.id)::numeric) * 100, 1)
          ELSE 0
        END AS accuracy_percentage,
        COUNT(CASE WHEN ans.selected_option = 'A' THEN 1 END) AS opt_a_count,
        COUNT(CASE WHEN ans.selected_option = 'B' THEN 1 END) AS opt_b_count,
        COUNT(CASE WHEN ans.selected_option = 'C' THEN 1 END) AS opt_c_count,
        COUNT(CASE WHEN ans.selected_option = 'D' THEN 1 END) AS opt_d_count
      FROM attempt_questions aq
      LEFT JOIN answers ans ON ans.attempt_id = aq.attempt_id AND ans.question_id = aq.question_id
      WHERE aq.question_id = $1
    `, [questionId]);

    const s = statsRes.rows[0];
    const totalAtt = parseInt(s?.total_attempts || 0, 10);
    const answered = parseInt(s?.answered_count || 0, 10);
    const correct = parseInt(s?.correct_count || 0, 10);
    const wrong = parseInt(s?.wrong_count || 0, 10);
    const unanswered = parseInt(s?.unanswered_count || 0, 10);
    const accuracy = parseFloat(s?.accuracy_percentage || 0);

    const optA = parseInt(s?.opt_a_count || 0, 10);
    const optB = parseInt(s?.opt_b_count || 0, 10);
    const optC = parseInt(s?.opt_c_count || 0, 10);
    const optD = parseInt(s?.opt_d_count || 0, 10);

    let quality = 'INSUFFICIENT_DATA';
    if (totalAtt >= 3) {
      if (accuracy >= 85) quality = 'VERY_EASY';
      else if (accuracy >= 65) quality = 'EASY';
      else if (accuracy >= 40) quality = 'NORMAL';
      else if (accuracy >= 20) quality = 'DIFFICULT';
      else quality = 'VERY_DIFFICULT';
    }

    const flags = {
      high_failure_rate: totalAtt >= 5 && accuracy < 25,
      high_skip_rate: totalAtt >= 5 && (unanswered / totalAtt) > 0.4,
      ambiguous: totalAtt >= 5 && (wrong > correct * 1.5),
      insufficient_data: totalAtt < 3
    };

    let recommendation = 'Question is well-calibrated and performing within expected parameters.';
    if (flags.insufficient_data) {
      recommendation = 'Insufficient student attempt data to evaluate quality reliably. Continue monitoring.';
    } else if (flags.ambiguous) {
      recommendation = 'Unusually high error rate relative to correct answers. Review question wording and option distractors for possible ambiguity.';
    } else if (flags.high_failure_rate) {
      recommendation = 'Failure rate exceeds 75%. Consider verifying question difficulty tag or revising question text.';
    } else if (flags.high_skip_rate) {
      recommendation = 'High skip rate (>40%). Students may be avoiding this question due to complexity or time constraints.';
    } else if (quality === 'VERY_EASY' && question.difficulty === 'HARD') {
      recommendation = 'Question tagged as HARD but exhibits >85% accuracy. Consider adjusting difficulty tag to EASY or MEDIUM.';
    }

    return {
      question: {
        id: question.id,
        question_text: question.question_text,
        category: question.category,
        difficulty: question.difficulty,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        marks: question.marks,
        is_active: question.is_active,
        created_at: question.created_at
      },
      analytics: {
        total_attempts: totalAtt,
        answered_count: answered,
        unanswered_count: unanswered,
        correct_count: correct,
        wrong_count: wrong,
        accuracy_percentage: accuracy,
        quality_indicator: quality,
        flags,
        recommendation,
        option_distribution: {
          A: { count: optA, percentage: answered > 0 ? Math.round((optA / answered) * 1000) / 10 : 0, is_correct: question.correct_option === 'A' },
          B: { count: optB, percentage: answered > 0 ? Math.round((optB / answered) * 1000) / 10 : 0, is_correct: question.correct_option === 'B' },
          C: { count: optC, percentage: answered > 0 ? Math.round((optC / answered) * 1000) / 10 : 0, is_correct: question.correct_option === 'C' },
          D: { count: optD, percentage: answered > 0 ? Math.round((optD / answered) * 1000) / 10 : 0, is_correct: question.correct_option === 'D' }
        }
      }
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getQuestionQualityList,
  getQuestionDetailedAnalytics
};
