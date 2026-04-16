// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const config = require("./src/config/config");
const { pool } = require("./src/config/database");
const logger = require("./src/utils/logger");
const configureRoutes = require("./src/routes");
const { requestLogger, requestId } = require("./src/middleware/requestLogger");
const { generalLimiter } = require("./src/middleware/rateLimiter");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || config.server.port || 5008;

/* ==========================================
   SOCKET.IO (if you're using it)
========================================== */
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
  },
});

app.set("io", io);
app.set("trust proxy", false); // Local only

/* ==========================================
   CORS CONFIG - Clean & Fixed for Local + Vercel
========================================== */
const allowedOrigins = config.cors.origin;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile, curl, etc.)
      if (!origin) return callback(null, true);

      // Allow listed origins + all Vercel preview URLs
      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    maxAge: 86400, // Cache preflight 24 hours
  }),
);

// Handle preflight requests explicitly
app.options("*", cors());

/* ==========================================
   MIDDLEWARES
========================================== */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (config.server.env !== "test") {
  app.use(requestLogger);
}

/* ==========================================
   HEALTH CHECK
========================================== */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      mode: "LOCAL",
      port: PORT,
    });
  } catch (e) {
    res.status(503).json({
      status: "unhealthy",
      error: e.message,
    });
  }
});

/* ==========================================
   ROUTES
========================================== */
configureRoutes(app);

/* ==========================================
   ERROR HANDLING
========================================== */
app.use(notFound);
app.use(errorHandler);

/* ==========================================
   START SERVER
========================================== */
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`🚀 Server running in LOCAL mode`);
      console.log(`📍 Port: http://localhost:${PORT}`);
      console.log(`🌐 Frontend: https://report-ex.vercel.app`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
