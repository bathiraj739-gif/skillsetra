const express = require('express');
const router = express.Router();
const intelligenceController = require('../controllers/intelligenceController');
const questionQualityController = require('../controllers/questionQualityController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All intelligence endpoints strictly require Admin authentication
router.use(authenticateToken, requireAdmin);

// Placement Intelligence Endpoints
router.get('/intelligence/overview', intelligenceController.getOverview);
router.get('/intelligence/departments', intelligenceController.getDepartments);
router.get('/intelligence/years', intelligenceController.getYears);
router.get('/intelligence/trends', intelligenceController.getTrends);
router.get('/intelligence/student-skills', intelligenceController.getStudentSkills);
router.get('/intelligence/topics', intelligenceController.getTopics);

// Question Quality Engine Endpoints
router.get('/intelligence/questions', questionQualityController.getQualityList);
router.get('/intelligence/questions/:id', questionQualityController.getQuestionAnalytics);
router.get('/intelligence/questions/:id/analytics', questionQualityController.getQuestionAnalytics);
router.get('/questions/:id/analytics', questionQualityController.getQuestionAnalytics);

module.exports = router;
