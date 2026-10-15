const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { requestIdMiddleware } = require("./middleware/requestIdMiddleware");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const questionRoutes = require("./routes/questionRoutes");
const aiQuestionRoutes = require("./routes/aiQuestionRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const studentAssignmentRoutes = require("./routes/studentAssignmentRoutes");
const attemptRoutes = require("./routes/attemptRoutes");
const resultRoutes = require("./routes/resultRoutes");
const studentResultRoutes = require("./routes/studentResultRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const agentRoutes = require("./routes/agentRoutes");
const adminEmailRoutes = require("./routes/adminEmailRoutes");
const adminIntelligenceRoutes = require("./routes/adminIntelligenceRoutes");
const { errorMiddleware } = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Attach Request ID & Request logging
app.use(requestIdMiddleware);

// Soft request timeout protection (30s)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: "Request timed out. Please retry.",
        code: "GATEWAY_TIMEOUT",
        requestId: req.requestId
      });
    }
  });
  next();
});

// Tiered Rate Limiters
// 1. Auth & Login (tuned for high-concurrency exams behind campus proxy/NAT)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please wait a moment before retrying.",
    code: "RATE_LIMITED_AUTH"
  }
});

// 2. AI Question Generation (protect API quota)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "AI generation rate limit reached. Please wait a moment.",
    code: "RATE_LIMITED_AI"
  }
});

// 3. High-concurrency Exam APIs (Answer autosave, question fetch) - Designed for 3,000+ concurrent students!
const examLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Exam traffic rate limit reached. Please retry.",
    code: "RATE_LIMITED_EXAM"
  }
});

// 4. General API Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api/agent", aiLimiter);
app.use("/api/student", examLimiter);
app.use("/api", generalLimiter);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SkillsetrA API is healthy and optimized for high concurrency",
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SkillsetrA Backend API is running",
    requestId: req.requestId
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/ai/questions", aiQuestionRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/student/assignments", studentAssignmentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/student/attempts", attemptRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/student/results", studentResultRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminEmailRoutes);
app.use("/api/admin", adminIntelligenceRoutes);

app.use(errorMiddleware);

module.exports = app;
