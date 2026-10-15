const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// Student own results
router.get('/my', authenticateToken, resultController.getStudentResults);

// All result admin routes require Admin authentication
router.get('/', authenticateToken, requireAdmin, resultController.getResults);
router.get('/:id', authenticateToken, requireAdmin, resultController.getResultById);

module.exports = router;
