const crypto = require("crypto");

function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId = (typeof incomingId === "string" && incomingId.length <= 64) 
    ? incomingId 
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    // Log with requestId for tracing
    if (res.statusCode >= 500) {
      console.error(`[REQ-ERR] [${requestId}] ${req.method} ${req.originalUrl} - status=${res.statusCode} duration=${duration}ms`);
    } else if (process.env.NODE_ENV !== "production" && req.originalUrl !== "/api/health") {
      console.log(`[REQ] [${requestId}] ${req.method} ${req.originalUrl} - status=${res.statusCode} duration=${duration}ms`);
    }
  });

  next();
}

module.exports = { requestIdMiddleware };
