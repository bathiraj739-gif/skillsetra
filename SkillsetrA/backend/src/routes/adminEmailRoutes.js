const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All admin email routes require JWT authentication and Admin role
router.use(authenticateToken);
router.use(requireAdmin);

// POST /api/admin/email/test
router.post('/email/test', studentController.sendTestEmail);

// POST /api/admin/students/:studentId/send-welcome-email
router.post('/students/:id/send-welcome-email', studentController.sendWelcomeEmail);

module.exports = router;
