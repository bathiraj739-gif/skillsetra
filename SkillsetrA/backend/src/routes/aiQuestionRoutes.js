const express = require('express');
const router = express.Router();
const aiQuestionController = require('../controllers/aiQuestionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All AI question generation routes require Admin authentication
router.use(authenticateToken, requireAdmin);

router.post('/generate', aiQuestionController.generateQuestions);

module.exports = router;
