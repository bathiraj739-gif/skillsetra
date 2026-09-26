const resultService = require('../services/resultService');

async function getResults(req, res, next) {
  try {
    const results = await resultService.getResults(req.query);
    return res.status(200).json({ success: true, message: 'Results fetched successfully', data: results });
  } catch (err) {
    next(err);
  }
}

async function getResultById(req, res, next) {
  try {
    const result = await resultService.getResultById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getStudentResults(req, res, next) {
  try {
    const results = await resultService.getStudentResults(req.user.userId);
    return res.status(200).json({ success: true, message: 'Results fetched successfully', data: results });
  } catch (err) {
    if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student profile not found' });
    next(err);
  }
}

async function getStudentResultById(req, res, next) {
  try {
    const result = await resultService.getStudentResultById(req.params.id, req.user.userId);
    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to result' });
    if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student profile not found' });
    next(err);
  }
}

async function getStudentAttemptReport(req, res, next) {
  try {
    const report = await resultService.getStudentAttemptReport(req.params.attemptId || req.params.id, req.user.userId);
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to report' });
    if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (err.message === 'ATTEMPT_NOT_COMPLETED') return res.status(400).json({ success: false, message: 'Attempt is not completed yet' });
    if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student profile not found' });
    next(err);
  }
}

module.exports = {
  getResults,
  getResultById,
  getStudentResults,
  getStudentResultById,
  getStudentAttemptReport
};

