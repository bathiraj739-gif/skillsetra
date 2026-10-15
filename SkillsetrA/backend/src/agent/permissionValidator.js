const { TOOL_REGISTRY } = require('./toolRegistry');

/**
 * Validates request permissions and parameters for Agent operations.
 */
function validateAgentPermission(req, toolName) {
  // 1. Auth & Admin Role Check
  if (!req.user || req.user.role?.toLowerCase() !== 'admin') {
    const err = new Error('ADMIN_ACCESS_REQUIRED');
    err.status = 403;
    throw err;
  }

  // 2. Tool Registry Check
  if (!toolName || !TOOL_REGISTRY[toolName]) {
    const err = new Error(`UNAUTHORIZED_OR_UNKNOWN_AGENT_TOOL: ${toolName}`);
    err.status = 400;
    throw err;
  }

  return true;
}

module.exports = {
  validateAgentPermission
};
