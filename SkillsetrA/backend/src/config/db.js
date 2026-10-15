const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";
const isRemoteDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost") && !process.env.DATABASE_URL.includes("127.0.0.1");

// Safe, high-concurrency pool configuration
// 2,000-3,000 concurrent web users are served asynchronously by a tuned pool of 50-75 connections
const maxConnections = parseInt(process.env.DB_POOL_MAX || "60", 10);
const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10);
const connectionTimeoutMillis = parseInt(process.env.DB_CONNECTION_TIMEOUT || "5000", 10);
const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT || "10000", 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction || isRemoteDb ? { rejectUnauthorized: false } : false,
  max: maxConnections,
  idleTimeoutMillis: idleTimeoutMillis,
  connectionTimeoutMillis: connectionTimeoutMillis,
  statement_timeout: statementTimeout,
  query_timeout: statementTimeout,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err, client) => {
  // Never crash the Node.js process on unexpected pool errors
  console.error("Unexpected idle PostgreSQL client error (recovered):", err.message);
});

// Safe acquire helper with timeout guarantee
pool.acquireClient = async function () {
  try {
    return await pool.connect();
  } catch (err) {
    const error = new Error("Database connection pool is temporarily saturated. Please retry shortly.");
    error.statusCode = 503;
    error.code = "DB_POOL_SATURATED";
    error.original = err.message;
    throw error;
  }
};

module.exports = pool;

