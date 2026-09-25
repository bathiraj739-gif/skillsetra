require("dotenv").config();
const http = require("http");
const app = require("./app");
const pool = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected successfully");

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
      console.log(`SkillsetrA backend running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
