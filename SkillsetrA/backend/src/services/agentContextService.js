// In-memory store for Agent short-term conversation context per Admin User
// Map<userId, { messages: [], lastAssessment: null, lastCandidates: [], lastQuestions: [] }>
const contextStore = new Map();

function getContext(userId) {
  if (!contextStore.has(userId)) {
    contextStore.set(userId, {
      history: [],
      lastAssessment: null,
      lastCandidates: [],
      lastQuestions: [],
      updatedAt: Date.now()
    });
  }
  return contextStore.get(userId);
}

function updateContext(userId, { userMessage, aiResponse, intentResult }) {
  const ctx = getContext(userId);

  // Keep last 10 messages
  ctx.history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  if (aiResponse) {
    ctx.history.push({ role: 'model', content: aiResponse, timestamp: new Date().toISOString() });
  }
  if (ctx.history.length > 20) {
    ctx.history = ctx.history.slice(ctx.history.length - 20);
  }

  // Update entity references if present in intentResult
  if (intentResult) {
    if (intentResult.assessment || intentResult.assessmentId) {
      ctx.lastAssessment = intentResult.assessment || { id: intentResult.assessmentId, title: intentResult.title };
    }
    if (intentResult.candidates && Array.isArray(intentResult.candidates)) {
      ctx.lastCandidates = intentResult.candidates;
    }
    if (intentResult.questions && Array.isArray(intentResult.questions)) {
      ctx.lastQuestions = intentResult.questions;
    }
  }

  ctx.updatedAt = Date.now();
  return ctx;
}

function clearHistory(userId) {
  contextStore.delete(userId);
}

module.exports = {
  getContext,
  updateContext,
  clearHistory
};
