const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/studentMiddleware');

// All student assignment routes require Student authentication
router.use(authenticateToken, requireStudent);

router.get('/', assignmentController.getStudentAssignments);
router.get('/:id', assignmentController.getStudentAssignmentById);

module.exports = router;
