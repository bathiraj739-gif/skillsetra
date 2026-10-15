const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const agentController = require('../controllers/agentController');

const router = express.Router();

// Memory storage for file uploads (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// All agent endpoints require authentication + Admin authorization
router.use(authenticateToken);
router.use(requireAdmin);

router.post('/chat', agentController.handleChat);
router.post('/files', upload.single('file'), agentController.handleFileUpload);
router.post('/web-import', agentController.handleWebImport);
router.post('/voice', agentController.handleVoice);
router.get('/history', agentController.getHistory);
router.post('/confirm', agentController.handleConfirm);
router.post('/cancel', agentController.handleCancel);

module.exports = router;
