const assessmentService = require('../services/assessmentService');

async function createAssessment(req, res, next) {
  try {
    const data = req.body;
    data.durationMinutes = data.durationMinutes != null ? Number(data.durationMinutes) : (data.duration_minutes != null ? Number(data.duration_minutes) : null);
    data.questionIds = data.questionIds || data.question_ids;

    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Invalid title' });
    }
    if (!data.durationMinutes || !Number.isInteger(data.durationMinutes) || data.durationMinutes <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid durationMinutes' });
    }
    if (!data.questionIds || !Array.isArray(data.questionIds) || data.questionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'questionIds must be a non-empty array' });
    }

    try {
      const assessment = await assessmentService.createAssessment(data, req.user.userId);
      return res.status(201).json({ success: true, message: 'Assessment created successfully', data: assessment });
    } catch (err) {
      if (['AT_LEAST_ONE_QUESTION_REQUIRED', 'INVALID_OR_INACTIVE_QUESTION_INCLUDED', 'UNSUPPORTED_QUESTION_CATEGORY'].includes(err.message)) {
        return res.status(400).json({ success: false, message: 'Invalid question selection. Ensure all questions are active and either APTITUDE or VERBAL.' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAssessments(req, res, next) {
  try {
    const result = await assessmentService.getAssessments(req.query);
    return res.status(200).json({ success: true, message: 'Assessments fetched successfully', data: result });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentById(req, res, next) {
  try {
    const assessment = await assessmentService.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    return res.status(200).json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentQuestions(req, res, next) {
  try {
    const assessment = await assessmentService.getAssessmentById(req.params.id);
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    return res.status(200).json({ success: true, data: assessment.questions || [] });
  } catch (err) {
    next(err);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const data = req.body;
    data.durationMinutes = data.durationMinutes != null ? Number(data.durationMinutes) : (data.duration_minutes != null ? Number(data.duration_minutes) : undefined);
    data.questionIds = data.questionIds || data.question_ids;
    if (data.status) {
      data.status = String(data.status).toUpperCase();
    }

    try {
      const updated = await assessmentService.updateAssessment(req.params.id, data, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assessment updated successfully', data: updated });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      if (err.message === 'ATTEMPTS_EXIST') return res.status(400).json({ success: false, message: 'Assessment questions cannot be modified after student attempts have started' });
      if (['AT_LEAST_ONE_QUESTION_REQUIRED', 'INVALID_OR_INACTIVE_QUESTION_INCLUDED', 'UNSUPPORTED_QUESTION_CATEGORY'].includes(err.message)) {
        return res.status(400).json({ success: false, message: 'Invalid question selection.' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function publishAssessment(req, res, next) {
  try {
    try {
      const updated = await assessmentService.publishAssessment(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assessment published successfully', data: updated });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      if (err.message === 'NOT_DRAFT') return res.status(400).json({ success: false, message: 'Only DRAFT assessments can be published' });
      if (['INVALID_ASSESSMENT_CONFIG', 'NO_QUESTIONS', 'CONTAINS_INACTIVE_QUESTIONS'].includes(err.message)) {
        return res.status(400).json({ success: false, message: 'Assessment fails publishing criteria (needs title, duration, total marks > 0, and active questions).' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function closeAssessment(req, res, next) {
  try {
    try {
      const updated = await assessmentService.closeAssessment(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assessment closed successfully', data: updated });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      if (err.message === 'NOT_PUBLISHED') return res.status(400).json({ success: false, message: 'Only PUBLISHED assessments can be closed' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function deleteAssessment(req, res, next) {
  try {
    try {
      await assessmentService.deleteAssessment(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assessment deleted successfully' });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      if (err.message === 'ASSESSMENT_IN_USE') return res.status(409).json({ success: false, message: 'Assessment cannot be deleted because it has existing assignments or attempts' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssessment,
  getAssessments,
  getAssessmentById,
  getAssessmentQuestions,
  updateAssessment,
  publishAssessment,
  closeAssessment,
  deleteAssessment
};
