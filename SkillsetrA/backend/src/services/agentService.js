const { TOOL_REGISTRY } = require('../agent/toolRegistry');
const { validateAgentPermission } = require('../agent/permissionValidator');
const agentIntentService = require('./agentIntentService');
const agentConfirmationService = require('./agentConfirmationService');
const agentContextService = require('./agentContextService');
const fileParserService = require('./fileParserService');
const pool = require('../config/db');

async function processUserMessage({ userMessage, message, req }) {
  const userId = req.user.userId;
  const rawText = userMessage || message || '';

  // 1. Get short-term conversation context
  const context = agentContextService.getContext(userId);

  // 2. Extract structured Intent using Gemini
  const intentData = await agentIntentService.extractIntentFromUserRequest({
    userMessage: rawText,
    conversationContext: context.history
  });

  const { intent, explanation, parameters, needsMoreInfo, followUpQuestion } = intentData;

  // If AI needs clarification from Admin
  if (needsMoreInfo || !intent || intent === 'UNKNOWN' || intent === 'NONE') {
    const aiMessage = followUpQuestion || explanation || "Could you please specify more details for your request?";
    agentContextService.updateContext(userId, { userMessage: rawText, aiResponse: aiMessage });
    return {
      status: 'WAITING_FOR_INPUT',
      aiMessage,
      intent: intent || 'UNKNOWN'
    };
  }

  // 3. Validate tool existence & admin permissions
  validateAgentPermission(req, intent);

  const tool = TOOL_REGISTRY[intent];

  // 4. Check if Mutation operation requires confirmation
  if (tool.requiresConfirmation) {
    let previewData = {};
    try {
      if (tool.preview) {
        previewData = await tool.preview(parameters, userId);
      } else {
        previewData = {
          actionSummary: explanation || `Execute ${intent}`,
          parameters
        };
      }
    } catch (previewErr) {
      const aiMessage = previewErr.message || 'The requested operation could not be prepared.';
      agentContextService.updateContext(userId, { userMessage: rawText, aiResponse: aiMessage });
      return {
        status: 'ERROR',
        aiMessage,
        intent
      };
    }

    const mergedParams = {
      ...parameters,
      ...(previewData.preparedQuestions ? { preparedQuestions: previewData.preparedQuestions } : {}),
      ...(previewData.questionIds ? { question_ids: previewData.questionIds } : {}),
      ...(previewData.studentIds ? { student_ids: previewData.studentIds } : {})
    };

    const pendingItem = agentConfirmationService.createPendingConfirmation({
      userId,
      toolName: intent,
      params: mergedParams,
      preview: previewData
    });

    const aiMessage = `I understand your request to: **${previewData.actionSummary || explanation}**. Please review the details below and confirm to proceed.`;
    agentContextService.updateContext(userId, { userMessage: rawText, aiResponse: aiMessage });

    return {
      status: 'WAITING_FOR_CONFIRMATION',
      confirmationId: pendingItem.confirmationId,
      intent,
      explanation,
      aiMessage,
      preview: previewData,
      expiresAt: pendingItem.expiresAt
    };
  }

  // 5. Execute read-only tool directly
  let executionResult;
  try {
    executionResult = await tool.execute(parameters, userId);
  } catch (execErr) {
    const aiMessage = execErr.message || 'Failed to query platform records.';
    agentContextService.updateContext(userId, { userMessage: rawText, aiResponse: aiMessage });
    return {
      status: 'ERROR',
      aiMessage,
      intent
    };
  }

  const aiMessage = `Here are the results for: **${explanation}**`;
  agentContextService.updateContext(userId, { userMessage, aiResponse: aiMessage, intentResult: executionResult });

  return {
    status: 'COMPLETED',
    intent,
    explanation,
    aiMessage,
    data: executionResult
  };
}

async function processFileUpload({ buffer, filename, mimetype, fileCategory, req }) {
  const userId = req.user.userId;

  if (fileCategory === 'CANDIDATES') {
    const parsed = await fileParserService.parseCandidateFile(buffer, filename, mimetype);
    const aiMessage = `I parsed **${parsed.candidates.length} candidate records** from \`${filename}\`. Would you like to validate and import these candidates?`;
    
    // Create pending confirmation for candidate import
    const pendingItem = agentConfirmationService.createPendingConfirmation({
      userId,
      toolName: 'IMPORT_CANDIDATES',
      params: { candidates: parsed.candidates, initialPassword: 'Student@123' },
      preview: {
        actionSummary: `Import ${parsed.candidates.length} candidate profiles from Excel`,
        filename,
        candidateCount: parsed.candidates.length,
        sample: parsed.candidates.slice(0, 5)
      }
    });

    return {
      status: 'WAITING_FOR_CONFIRMATION',
      confirmationId: pendingItem.confirmationId,
      intent: 'IMPORT_CANDIDATES',
      aiMessage,
      preview: pendingItem.preview,
      expiresAt: pendingItem.expiresAt
    };
  } else {
    // Default: Question Bank Import
    const parsed = await fileParserService.parseQuestionFile(buffer, filename, mimetype);

    const aiMessage = `Uploaded \`${filename}\` parsed successfully!\n\n` +
      `• Valid Questions: **${parsed.summary.validCount}**\n` +
      `• Exact Duplicates: **${parsed.summary.exactDuplicatesCount}**\n` +
      `• Potential Similar Duplicates: **${parsed.summary.potentialDuplicatesCount}**\n` +
      `• Invalid Rows: **${parsed.summary.invalidCount}**`;

    const pendingItem = agentConfirmationService.createPendingConfirmation({
      userId,
      toolName: 'IMPORT_QUESTIONS',
      params: { questions: parsed.validQuestions },
      preview: {
        actionSummary: `Import ${parsed.summary.validCount} valid questions into Question Bank`,
        filename,
        summary: parsed.summary,
        sample: parsed.validQuestions.slice(0, 3)
      }
    });

    return {
      status: 'WAITING_FOR_CONFIRMATION',
      confirmationId: pendingItem.confirmationId,
      intent: 'IMPORT_QUESTIONS',
      aiMessage,
      preview: pendingItem.preview,
      expiresAt: pendingItem.expiresAt,
      fileDetails: parsed
    };
  }
}

async function processWebImport({ url, query, pastedText, count = 20, category = 'APTITUDE', difficulty = 'MEDIUM', req }) {
  const userId = req.user.userId;
  const webImportService = require('./webImportService');

  let result;
  let sourceSummary = '';

  if (url) {
    result = await webImportService.importFromUrl({ url, category, difficulty, count });
    sourceSummary = `URL: \`${url}\``;
  } else if (pastedText) {
    result = await webImportService.importFromPastedText({ text: pastedText, category, difficulty, count });
    sourceSummary = 'Pasted Text / Online Clipboard';
  } else {
    const searchQ = query || 'Aptitude Placement Questions';
    result = await webImportService.searchWebQuestions({ query: searchQ, count, category, difficulty });
    sourceSummary = `Search Query: "${searchQ}"`;
  }

  const aiMessage = `Extracted questions from ${sourceSummary}:\n\n` +
    `• Valid Questions: **${result.summary.validCount}**\n` +
    `• Exact Duplicates: **${result.summary.duplicatesCount}**\n` +
    `• Needs Review (Unverified answer): **${result.summary.needsReviewCount}**\n` +
    `• Incomplete/Invalid: **${result.summary.invalidCount}**`;

  const pendingItem = agentConfirmationService.createPendingConfirmation({
    userId,
    toolName: 'IMPORT_QUESTIONS',
    params: { questions: result.validQuestions },
    preview: {
      actionSummary: `Import ${result.summary.validCount} verified questions into Question Bank`,
      sourceSummary,
      summary: result.summary,
      sample: result.validQuestions.slice(0, 3),
      needsReview: result.needsReviewQuestions,
      duplicates: result.duplicates
    }
  });

  return {
    status: 'WAITING_FOR_CONFIRMATION',
    confirmationId: pendingItem.confirmationId,
    intent: 'IMPORT_QUESTIONS',
    aiMessage,
    preview: pendingItem.preview,
    expiresAt: pendingItem.expiresAt,
    webDetails: result
  };
}

async function confirmAction({ confirmationId, req }) {
  const userId = req.user.userId;

  const pending = agentConfirmationService.consumePendingConfirmation(confirmationId, userId);
  if (!pending) {
    throw new Error('CONFIRMATION_EXPIRED_OR_NOT_FOUND');
  }

  const { toolName, params } = pending;
  validateAgentPermission(req, toolName);

  let result;
  if (toolName === 'IMPORT_QUESTIONS') {
    const questionService = require('./questionService');
    const importedList = [];
    let skippedCount = 0;
    for (const q of params.questions) {
      try {
        const created = await questionService.createQuestion(q, userId);
        importedList.push(created);
      } catch (err) {
        skippedCount++;
      }
    }
    result = {
      importedCount: importedList.length,
      skippedCount,
      importedQuestions: importedList
    };
  } else if (toolName === 'IMPORT_CANDIDATES') {
    const studentController = require('../controllers/studentController');
    // Create mock res to execute bulk import via existing handler or authService directly
    const authService = require('./authService');
    let registeredCount = 0;
    let skippedCount = 0;
    for (const c of params.candidates) {
      try {
        await authService.createStudentAccount({
          username: c.register_number,
          password: params.initialPassword || 'Student@123',
          full_name: c.full_name,
          register_number: c.register_number,
          email: c.email || null,
          department: c.department || null,
          year: c.year ? String(c.year) : null,
          section: c.section || null,
          phone: c.phone || null
        });
        registeredCount++;
      } catch (e) {
        skippedCount++;
      }
    }
    result = { registeredCount, skippedCount };
  } else {
    const tool = TOOL_REGISTRY[toolName];
    result = await tool.execute(params, userId);
  }

  // Audit Log Entry
  await pool.query(
    `INSERT INTO activity_logs (user_id, action, entity_type, metadata) VALUES ($1, $2, $3, $4)`,
    [userId, `AGENT_${toolName}`, 'agent_operation', JSON.stringify({ params, confirmationId })]
  );

  const aiMessage = `Operation **${toolName}** executed successfully!`;
  agentContextService.updateContext(userId, { userMessage: `Confirmed ${toolName}`, aiResponse: aiMessage, intentResult: result });

  return {
    status: 'COMPLETED',
    toolName,
    aiMessage,
    data: result
  };
}

async function cancelAction({ confirmationId, req }) {
  const userId = req.user.userId;
  const cancelled = agentConfirmationService.cancelPendingConfirmation(confirmationId, userId);
  const aiMessage = cancelled
    ? 'Operation has been cancelled. No changes were made.'
    : 'Confirmation has already expired or was not found.';

  return {
    status: 'CANCELLED',
    aiMessage
  };
}

module.exports = {
  processUserMessage,
  processFileUpload,
  processWebImport,
  confirmAction,
  cancelAction
};
