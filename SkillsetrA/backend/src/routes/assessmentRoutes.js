const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Admin routes
router.post('/', authenticateToken, requireAdmin, assessmentController.createAssessment);
router.get('/', authenticateToken, requireAdmin, assessmentController.getAssessments);
router.get('/:id/questions', authenticateToken, requireAdmin, assessmentController.getAssessmentQuestions);
router.put('/:id', authenticateToken, requireAdmin, assessmentController.updateAssessment);
router.patch('/:id/publish', authenticateToken, requireAdmin, assessmentController.publishAssessment);
router.patch('/:id/close', authenticateToken, requireAdmin, assessmentController.closeAssessment);
router.delete('/:id', authenticateToken, requireAdmin, assessmentController.deleteAssessment);

// Assessment view for candidate instructions & details (accessible by authenticated student and admin)
router.get('/:id', authenticateToken, assessmentController.getAssessmentById);

module.exports = router;
