const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All dashboard routes require Admin authentication
router.use(authenticateToken, requireAdmin);

router.get('/admin/dashboard/overview', dashboardController.getDashboardOverview);
router.get('/admin/dashboard/activity', dashboardController.getRecentActivity);
router.get('/admin/activities', dashboardController.getRecentActivity);
router.get('/admin/dashboard/assessments', dashboardController.getAssessmentSummaries);
router.get('/admin/monitoring', dashboardController.getAssessmentMonitoring);
router.get('/admin/monitoring/live', dashboardController.getLiveMonitoringFeed);
router.get('/admin/monitoring/:assignmentId', dashboardController.getAssignmentMonitoringDetails);

module.exports = router;
