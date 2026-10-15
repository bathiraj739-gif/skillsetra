const crypto = require('crypto');

// In-memory store for pending agent mutation confirmations
// Structure: Map<confirmationId, { confirmationId, userId, toolName, params, preview, createdAt, expiresAt }>
const pendingConfirmations = new Map();

// Clean up expired confirmations every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of pendingConfirmations.entries()) {
    if (item.expiresAt < now) {
      pendingConfirmations.delete(id);
    }
  }
}, 60000);

function createPendingConfirmation({ userId, toolName, params, preview }) {
  const confirmationId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 minute expiration

  const pendingItem = {
    confirmationId,
    userId,
    toolName,
    params,
    preview,
    createdAt: new Date(now).toISOString(),
    expiresAt
  };

  pendingConfirmations.set(confirmationId, pendingItem);
  return pendingItem;
}

function getPendingConfirmation(confirmationId, userId) {
  const item = pendingConfirmations.get(confirmationId);
  if (!item) return null;

  if (item.userId !== userId) {
    throw new Error('CONFIRMATION_USER_MISMATCH');
  }

  if (item.expiresAt < Date.now()) {
    pendingConfirmations.delete(confirmationId);
    throw new Error('CONFIRMATION_EXPIRED');
  }

  return item;
}

function consumePendingConfirmation(confirmationId, userId) {
  const item = getPendingConfirmation(confirmationId, userId);
  if (item) {
    pendingConfirmations.delete(confirmationId);
  }
  return item;
}

function cancelPendingConfirmation(confirmationId, userId) {
  const item = getPendingConfirmation(confirmationId, userId);
  if (item) {
    pendingConfirmations.delete(confirmationId);
    return true;
  }
  return false;
}

module.exports = {
  createPendingConfirmation,
  getPendingConfirmation,
  consumePendingConfirmation,
  cancelPendingConfirmation
};
