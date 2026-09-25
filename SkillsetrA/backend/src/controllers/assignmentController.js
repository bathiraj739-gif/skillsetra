const assignmentService = require('../services/assignmentService');

async function createAssignments(req, res, next) {
  try {
    const data = req.body;
    try {
      const result = await assignmentService.createAssignments(data, req.user.userId);
      return res.status(201).json({ success: true, message: 'Assignments created successfully', data: result });
    } catch (err) {
      if (err.message === 'ASSESSMENT_IS_DRAFT') return res.status(400).json({ success: false, message: 'Only published assessments can be assigned' });
      if (err.message === 'ASSESSMENT_IS_CLOSED') return res.status(400).json({ success: false, message: 'Closed assessments cannot be assigned' });
      if (err.message === 'INVALID_STUDENTS') return res.status(400).json({ success: false, message: 'One or more students are invalid' });
      if (['ASSESSMENT_REQUIRED', 'STUDENTS_REQUIRED', 'ASSESSMENT_NOT_FOUND', 'ASSESSMENT_INVALID_CONFIG'].includes(err.message)) {
        return res.status(400).json({ success: false, message: 'Invalid assignment configuration' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function getAssignments(req, res, next) {
  try {
    const result = await assignmentService.getAssignments(req.query);
    return res.status(200).json({ success: true, message: 'Assignments fetched successfully', data: result });
  } catch (err) {
    next(err);
  }
}

async function getAssignmentById(req, res, next) {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.status(200).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

async function updateAssignment(req, res, next) {
  try {
    try {
      const updated = await assignmentService.updateAssignment(req.params.id, req.body, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assignment updated successfully', data: updated });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assignment not found' });
      if (err.message === 'ATTEMPT_EXISTS') return res.status(400).json({ success: false, message: 'Cannot update assignment after attempt started' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function deleteAssignment(req, res, next) {
  try {
    try {
      await assignmentService.deleteAssignment(req.params.id, req.user.userId);
      return res.status(200).json({ success: true, message: 'Assignment deleted successfully' });
    } catch (err) {
      if (err.message === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Assignment not found' });
      if (err.message === 'ATTEMPT_EXISTS') return res.status(409).json({ success: false, message: 'Assignment cannot be deleted because the student has started the assessment' });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// Student APIs
async function getStudentAssignments(req, res, next) {
  try {
    const assignments = await assignmentService.getStudentAssignments(req.user.userId);
    return res.status(200).json({ success: true, message: 'Assignments fetched successfully', data: assignments });
  } catch (err) {
    if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student profile not found' });
    next(err);
  }
}

async function getStudentAssignmentById(req, res, next) {
  try {
    const assignment = await assignmentService.getStudentAssignmentById(req.params.id, req.user.userId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.status(200).json({ success: true, data: assignment });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED_ACCESS') return res.status(403).json({ success: false, message: 'Unauthorized access to assignment' });
    if (err.message === 'STUDENT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Student profile not found' });
    next(err);
  }
}

module.exports = {
  createAssignments,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  getStudentAssignments,
  getStudentAssignmentById
};
