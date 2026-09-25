const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const questionRoutes = require("./routes/questionRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const studentAssignmentRoutes = require("./routes/studentAssignmentRoutes");
const attemptRoutes = require("./routes/attemptRoutes");
const resultRoutes = require("./routes/resultRoutes");
const studentResultRoutes = require("./routes/studentResultRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { errorMiddleware } = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/student/assignments", studentAssignmentRoutes);
app.use("/api/student/attempts", attemptRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/student/results", studentResultRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SkillsetrA API is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", dashboardRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SkillsetrA Backend API is running",
  });
});

app.use(errorMiddleware);

module.exports = app;
