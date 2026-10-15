const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All student routes require authentication
router.use(authenticateToken);

// Admin-only student management
router.get('/', requireAdmin, studentController.getStudents);
router.post('/', requireAdmin, studentController.createStudent);
router.post('/email/test', requireAdmin, studentController.sendTestEmail);
router.post('/bulk-validate', requireAdmin, studentController.bulkValidateCandidates);
router.post('/bulk-import', requireAdmin, studentController.bulkImportCandidates);
router.post('/:id/send-welcome-email', requireAdmin, studentController.sendWelcomeEmail);
router.delete('/:id', requireAdmin, studentController.deleteStudent);

// Student or Admin can view/update profile
// (studentController enforces that students can only view/update their own allowed fields)
router.get('/:id', studentController.getStudentById);
router.put('/:id', studentController.updateStudent);

module.exports = router;
