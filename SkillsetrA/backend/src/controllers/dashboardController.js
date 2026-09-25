const dashboardService = require('../services/dashboardService');

async function getDashboardOverview(req, res, next) {
  try {
    const { assessmentId } = req.query;
    try {
      const data = await dashboardService.getDashboardOverview(assessmentId);
      return res.status(200).json({ success: true, message: 'Dashboard overview fetched successfully', data });
    } catch (err) {
      if (err.message === 'ASSESSMENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getRecentActivity(req, res, next) {
  try {
    const { assessmentId, limit } = req.query;
    const data = await dashboardService.getRecentActivity(assessmentId, limit);
    return res.status(200).json({ success: true, message: 'Recent activity fetched successfully', data });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentSummaries(req, res, next) {
  try {
    const data = await dashboardService.getAssessmentSummaries(req.query);
    return res.status(200).json({ success: true, message: 'Assessment summaries fetched successfully', data });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentMonitoring(req, res, next) {
  try {
    const { assessmentId } = req.query;
    if (!assessmentId) return res.status(400).json({ success: false, message: 'assessmentId is required' });

    try {
      const data = await dashboardService.getAssessmentMonitoring(assessmentId, req.query);
      return res.status(200).json({ success: true, message: 'Assessment monitoring data fetched successfully', data });
    } catch (err) {
      if (err.message === 'ASSESSMENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Assessment not found' });
      if (err.message === 'INVALID_STATUS') return res.status(400).json({ success: false, message: 'Invalid monitoring status' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAssignmentMonitoringDetails(req, res, next) {
  try {
    try {
      const data = await dashboardService.getAssignmentMonitoringDetails(req.params.assignmentId);
      return res.status(200).json({ success: true, message: 'Assignment monitoring details fetched successfully', data });
    } catch (err) {
      if (err.message === 'ASSIGNMENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Assignment not found' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getLiveMonitoringFeed(req, res, next) {
  try {
    const data = await dashboardService.getLiveMonitoringFeed();
    return res.status(200).json({ success: true, message: 'Live monitoring feed fetched successfully', data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardOverview,
  getRecentActivity,
  getLiveMonitoringFeed,
  getAssessmentSummaries,
  getAssessmentMonitoring,
  getAssignmentMonitoringDetails
};
