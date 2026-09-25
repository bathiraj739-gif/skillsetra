const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/admin/login', authController.adminLogin);
router.post('/student/login', authController.studentLogin);
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authController.logout);
router.post('/change-password', authenticateToken, authController.changePassword);
router.put('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
