require("dotenv").config();
const http = require("http");
const app = require("./app");
const pool = require("./config/db");
const { initSocket } = require("./socket");
const emailService = require("./services/emailService");

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  try {
    // Check initial db connection
    await pool.query("SELECT NOW()");
    console.log("✓ PostgreSQL connected & connection pool initialized");

    // Validate email configuration
    emailService.validateEmailConfig();

    server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`✓ SkillsetrA high-concurrency backend running on port ${PORT}`);
      console.log(`✓ Base URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection check failed on startup:");
    console.error(error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log("[SHUTDOWN] HTTP server closed to new connections.");
      try {
        await pool.end();
        console.log("[SHUTDOWN] PostgreSQL pool drained and closed successfully.");
        process.exit(0);
      } catch (err) {
        console.error("[SHUTDOWN] Error closing PostgreSQL pool:", err.message);
        process.exit(1);
      }
    });

    // Fallback force shutdown after 10s if connections linger
    setTimeout(() => {
      console.error("[SHUTDOWN] Forcefully terminating process after 10s timeout.");
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();
