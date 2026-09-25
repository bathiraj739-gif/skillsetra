const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/studentMiddleware');

// All student result routes require Student authentication
router.use(authenticateToken, requireStudent);

router.get('/', resultController.getStudentResults);
router.get('/:id', resultController.getStudentResultById);

module.exports = router;
