const attemptService = require('../services/attemptService');

async function startAttempt(req, res, next) {
  try {
    const { assignmentId } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: 'assignmentId is required' });
    }

    try {
      const attempt = await attemptService.startAttempt(assignmentId, req.user.userId);
      return res.status(201).json({ success: true, message: 'Attempt started successfully', data: attempt });
    } catch (err) {
      if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student not found' });
      if (err.message === 'ASSIGNMENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Assignment not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to assignment' });
      if (err.message === 'ASSIGNMENT_EXPIRED') return res.status(400).json({ success: false, message: 'Assignment has expired' });
      if (err.message === 'ASSIGNMENT_COMPLETED') return res.status(400).json({ success: false, message: 'Assignment is already completed' });
      if (err.message === 'ATTEMPT_ALREADY_STARTED') return res.status(400).json({ success: false, message: 'Attempt already started' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAttemptQuestions(req, res, next) {
  try {
    try {
      const questions = await attemptService.getAttemptQuestions(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Questions fetched successfully', data: questions });
    } catch (err) {
      if (err.message === 'ATTEMPT_EXPIRED') return res.status(400).json({ success: false, message: 'Time expired. Assessment has been automatically submitted.' });
      if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to attempt' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function saveAnswer(req, res, next) {
  try {
    const { questionId, selectedOption } = req.body;
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' });
    }
    if (selectedOption !== undefined && selectedOption !== null && !['A', 'B', 'C', 'D'].includes(selectedOption)) {
      return res.status(400).json({ success: false, message: 'Invalid selectedOption' });
    }

    try {
      await attemptService.saveAnswer(req.params.id, questionId, selectedOption, req.user.userId);
      return res.status(200).json({ success: true, message: 'Answer saved successfully' });
    } catch (err) {
      if (err.message === 'ATTEMPT_EXPIRED') return res.status(400).json({ success: false, message: 'Time expired. Assessment has been automatically submitted.' });
      if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to attempt' });
      if (err.message === 'ATTEMPT_NOT_IN_PROGRESS') return res.status(400).json({ success: false, message: 'Attempt is not in progress' });
      if (err.message === 'QUESTION_NOT_IN_ATTEMPT') return res.status(400).json({ success: false, message: 'Question does not belong to this attempt' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function submitAttempt(req, res, next) {
  try {
    try {
      const result = await attemptService.submitAttempt(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Attempt submitted successfully', data: result });
    } catch (err) {
      if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to attempt' });
      if (err.message === 'ATTEMPT_ALREADY_SUBMITTED') return res.status(400).json({ success: false, message: 'Attempt already submitted' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAttempt(req, res, next) {
  try {
    try {
      const data = await attemptService.getAttempt(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Attempt fetched successfully', data });
    } catch (err) {
      if (err.message === 'ATTEMPT_EXPIRED') return res.status(400).json({ success: false, message: 'Time expired. Assessment has been automatically submitted.' });
      if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to attempt' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAttemptStatus(req, res, next) {
  try {
    try {
      const status = await attemptService.getAttemptStatus(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Attempt status fetched successfully', data: status });
    } catch (err) {
      if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
      if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to attempt' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}


module.exports = {
  startAttempt,
  getAttempt,
  getAttemptQuestions,
  getAttemptStatus,
  saveAnswer,
  submitAttempt
};
