const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

// All assignment admin routes require Admin authentication
router.use(authenticateToken, requireAdmin);

router.post('/', assignmentController.createAssignments);
router.get('/', assignmentController.getAssignments);
router.get('/:id', assignmentController.getAssignmentById);
router.put('/:id', assignmentController.updateAssignment);
router.delete('/:id', assignmentController.deleteAssignment);
// Note: "PATCH /api/assignments/:id/cancel" wasn't explicitly asked for as a separate route if we implement cancellation by DELETE per the prompt's preference:
// "Prefer: DELETE /api/assignments/:id for unused assignments instead of inventing a new status."
// But it was mentioned to "Create: PATCH /api/assignments/:id/cancel".
// I'll add the route to route it to deleteAssignment so both work.
router.patch('/:id/cancel', assignmentController.deleteAssignment);

module.exports = router;
