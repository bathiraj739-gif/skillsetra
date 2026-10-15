const agentService = require('../services/agentService');
const agentContextService = require('../services/agentContextService');

async function handleChat(req, res, next) {
  try {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message command is required.'
      });
    }

    const result = await agentService.processUserMessage({
      userMessage: message.trim(),
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function handleFileUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded.'
      });
    }

    const fileCategory = req.body.fileCategory || 'QUESTIONS';

    const result = await agentService.processFileUpload({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      fileCategory,
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function handleVoice(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Transcribed text is required for voice command processing.'
      });
    }

    const result = await agentService.processUserMessage({
      userMessage: text.trim(),
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function handleConfirm(req, res, next) {
  try {
    const { confirmationId } = req.body;
    if (!confirmationId) {
      return res.status(400).json({
        success: false,
        message: 'confirmationId is required.'
      });
    }

    const result = await agentService.confirmAction({
      confirmationId,
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function handleCancel(req, res, next) {
  try {
    const { confirmationId } = req.body;
    if (!confirmationId) {
      return res.status(400).json({
        success: false,
        message: 'confirmationId is required.'
      });
    }

    const result = await agentService.cancelAction({
      confirmationId,
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function handleWebImport(req, res, next) {
  try {
    const { url, query, pastedText, count, category, difficulty } = req.body;
    if (!url && !query && !pastedText) {
      return res.status(400).json({
        success: false,
        message: 'Either url, search query, or pastedText is required for web import.'
      });
    }

    const result = await agentService.processWebImport({
      url,
      query,
      pastedText,
      count: Number(count) || 20,
      category: category || 'APTITUDE',
      difficulty: difficulty || 'MEDIUM',
      req
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const userId = req.user.userId;
    const ctx = agentContextService.getContext(userId);

    return res.status(200).json({
      success: true,
      data: {
        history: ctx.history
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleChat,
  handleFileUpload,
  handleWebImport,
  handleVoice,
  handleConfirm,
  handleCancel,
  getHistory
};
