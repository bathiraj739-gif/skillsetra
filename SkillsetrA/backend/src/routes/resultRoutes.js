const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All result admin routes require Admin authentication
router.use(authenticateToken, requireAdmin);

router.get('/', resultController.getResults);
router.get('/:id', resultController.getResultById);

module.exports = router;
