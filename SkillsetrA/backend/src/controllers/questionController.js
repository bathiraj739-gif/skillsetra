const questionService = require('../services/questionService');

async function createQuestion(req, res, next) {
  try {
    const data = req.body;
    
    if (data.marks == null || data.marks === '') {
      data.marks = 1;
    } else {
      data.marks = Number(data.marks);
    }

    if (data.category) data.category = String(data.category).toUpperCase();
    if (data.difficulty) data.difficulty = String(data.difficulty).toUpperCase();
    if (data.correct_option) data.correct_option = String(data.correct_option).toUpperCase();

    if (!data.question_text || !data.category || !data.difficulty || 
        !data.option_a || !data.option_b || !data.option_c || !data.option_d || 
        !data.correct_option || isNaN(data.marks)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['APTITUDE', 'VERBAL'].includes(data.category)) {
      return res.status(400).json({ success: false, message: 'Invalid question category' });
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(data.difficulty)) {
      return res.status(400).json({ success: false, message: 'Invalid question difficulty' });
    }

    if (!['A', 'B', 'C', 'D'].includes(data.correct_option)) {
      return res.status(400).json({ success: false, message: 'Invalid correct_option' });
    }

    if (data.marks <= 0) {
      return res.status(400).json({ success: false, message: 'Marks must be greater than 0' });
    }

    try {
      const question = await questionService.createQuestion(data, req.user.userId);
      return res.status(201).json({
        success: true,
        message: 'Question created successfully',
        data: question
      });
    } catch (err) {
      if (err.message === 'DUPLICATE_QUESTION') {
        return res.status(409).json({ success: false, message: 'A similar question already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getQuestions(req, res, next) {
  try {
    const result = await questionService.getQuestions(req.query);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getQuestionById(req, res, next) {
  try {
    const question = await questionService.getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    return res.status(200).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const data = req.body;
    
    if (data.category && !['APTITUDE', 'VERBAL'].includes(data.category)) {
      return res.status(400).json({ success: false, message: 'Invalid question category' });
    }
    if (data.difficulty && !['EASY', 'MEDIUM', 'HARD'].includes(data.difficulty)) {
      return res.status(400).json({ success: false, message: 'Invalid question difficulty' });
    }
    if (data.correct_option && !['A', 'B', 'C', 'D'].includes(data.correct_option)) {
      return res.status(400).json({ success: false, message: 'Invalid correct_option' });
    }
    if (data.marks !== undefined && data.marks <= 0) {
      return res.status(400).json({ success: false, message: 'Marks must be greater than 0' });
    }

    try {
      const updated = await questionService.updateQuestion(req.params.id, data, req.user.userId);
      return res.status(200).json({ success: true, message: 'Question updated successfully', data: updated });
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Question not found' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    try {
      await questionService.softDeleteQuestion(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Question deleted successfully' });
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'Question not found' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion
};
