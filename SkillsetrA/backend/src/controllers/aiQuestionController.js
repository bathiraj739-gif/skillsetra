const geminiQuestionService = require('../services/geminiQuestionService');

// Simple in-memory rate limiting per admin user to prevent AI quota abuse
const lastRequestTimeMap = new Map();
const MIN_REQUEST_INTERVAL_MS = 3000; // 3 seconds minimum between AI generations per admin

async function generateQuestions(req, res, next) {
  try {
    const { category, topic, difficulty, count, marks } = req.body;

    const adminUserId = req.user?.userId || req.user?.id || 'admin';
    const now = Date.now();
    const lastTime = lastRequestTimeMap.get(adminUserId) || 0;

    if (now - lastTime < MIN_REQUEST_INTERVAL_MS) {
      return res.status(429).json({
        success: false,
        message: 'Please wait a few seconds before generating AI questions again.'
      });
    }

    // Input Validation
    const normCategory = (category || '').toString().trim().toUpperCase();
    const normDifficulty = (difficulty || '').toString().trim().toUpperCase();
    const normTopic = (topic || '').toString().trim();
    const parsedCount = parseInt(count, 10);
    const parsedMarks = parseInt(marks, 10);

    if (!['APTITUDE', 'VERBAL'].includes(normCategory)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be APTITUDE or VERBAL.'
      });
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(normDifficulty)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid difficulty. Must be EASY, MEDIUM, or HARD.'
      });
    }

    const allowedCounts = [1, 5, 10, 20, 25, 50];
    if (isNaN(parsedCount) || !allowedCounts.includes(parsedCount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question count. Allowed counts: 1, 5, 10, 20, 25, 50.'
      });
    }

    if (isNaN(parsedMarks) || parsedMarks <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid marks per question. Must be a positive integer.'
      });
    }

    if (!normTopic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required.'
      });
    }

    lastRequestTimeMap.set(adminUserId, now);

    // Call Gemini AI Generation Service
    const questions = await geminiQuestionService.generateQuestionsFromGemini({
      category: normCategory,
      topic: normTopic,
      difficulty: normDifficulty,
      count: parsedCount,
      marks: parsedMarks
    });

    return res.status(200).json({
      success: true,
      message: `Successfully generated ${questions.length} AI question(s)`,
      data: {
        questions,
        count: questions.length,
        category: normCategory,
        topic: normTopic,
        difficulty: normDifficulty,
        marks: parsedMarks
      }
    });
  } catch (err) {
    console.error('AI Question Generation Controller Error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'An error occurred while generating questions with AI.'
    });
  }
}

module.exports = {
  generateQuestions
};
