function errorMiddleware(err, req, res, next) {
  const requestId = req.requestId || "unknown";
  const statusCode = err.statusCode || err.status || 500;

  // Mask database credentials or internal errors safely
  let clientMessage = err.message || "An unexpected error occurred. Please try again.";
  let errorCode = err.code || "INTERNAL_SERVER_ERROR";

  if (statusCode >= 500) {
    console.error(`[UNHANDLED ERROR] [${requestId}]:`, err);

    if (err.code === "DB_POOL_SATURATED" || err.message?.includes("timeout") || err.message?.includes("Connection terminated")) {
      clientMessage = "The server is currently under high load. Please retry your request shortly.";
      errorCode = "TEMPORARY_SERVER_OVERLOAD";
    } else {
      clientMessage = "Internal server error. Please try again later.";
    }
  }

  // Common known error mapping
  if (err.message === "STUDENT_NOT_FOUND" || err.message === "ASSESSMENT_NOT_FOUND" || err.message === "ASSIGNMENT_NOT_FOUND" || err.message === "ATTEMPT_NOT_FOUND") {
    return res.status(404).json({
      success: false,
      message: err.message.replace(/_/g, " ").toLowerCase(),
      code: err.message,
      requestId
    });
  }

  if (err.message === "UNAUTHORIZED_ACCESS") {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to access this resource.",
      code: "UNAUTHORIZED_ACCESS",
      requestId
    });
  }

  if (err.message === "ATTEMPT_EXPIRED" || err.message === "ASSIGNMENT_EXPIRED") {
    return res.status(400).json({
      success: false,
      message: "This assessment session has expired.",
      code: err.message,
      requestId
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
    code: errorCode,
    requestId
  });
}

module.exports = {
  errorMiddleware
};
