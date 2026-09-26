const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const resultController = require('../controllers/resultController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/studentMiddleware');

// All student attempt routes require Student authentication
router.use(authenticateToken, requireStudent);

router.post('/', attemptController.startAttempt);
router.post('/start', attemptController.startAttempt);
router.get('/:id', attemptController.getAttempt);
router.get('/:id/questions', attemptController.getAttemptQuestions);
router.get('/:id/status', attemptController.getAttemptStatus);
router.get('/:id/report', resultController.getStudentAttemptReport);
router.post('/:id/answers', attemptController.saveAnswer);
router.post('/:id/submit', attemptController.submitAttempt);

module.exports = router;

