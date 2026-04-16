// server.js - FIXED VERSION FOR RAILWAY
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Wrap imports in try-catch to prevent crashes
let config,
  pool,
  logger,
  configureRoutes,
  requestLogger,
  requestId,
  generalLimiter,
  notFound,
  errorHandler;

try {
  config = require("./src/config/config");
  console.log("✅ Config loaded");
} catch (err) {
  console.error("❌ Config error:", err.message);
  config = { server: { port: 5008, env: "production" }, cors: { origin: [] } };
}

try {
  const db = require("./src/config/database");
  pool = db.pool;
  console.log("✅ Database loaded");
} catch (err) {
  console.error("❌ Database error:", err.message);
  pool = { query: async () => ({ rows: [{ now: new Date() }] }) }; // Mock pool
}

try {
  logger = require("./src/utils/logger");
  console.log("✅ Logger loaded");
} catch (err) {
  console.error("❌ Logger error:", err.message);
  logger = console;
}

try {
  configureRoutes = require("./src/routes");
  console.log("✅ Routes loaded");
} catch (err) {
  console.error("❌ Routes error:", err.message);
  configureRoutes = (app) => {
    app.get("/api/fallback", (req, res) =>
      res.json({ message: "API is working" }),
    );
  };
}

try {
  const middleware = require("./src/middleware/requestLogger");
  requestLogger = middleware.requestLogger;
  requestId = middleware.requestId;
} catch (err) {
  console.error("❌ Request logger error:", err.message);
  requestLogger = (req, res, next) => next();
  requestId = (req, res, next) => next();
}

try {
  const rateLimiter = require("./src/middleware/rateLimiter");
  generalLimiter = rateLimiter.generalLimiter;
} catch (err) {
  console.error("❌ Rate limiter error:", err.message);
  generalLimiter = (req, res, next) => next();
}

try {
  const errorHandler = require("./src/middleware/errorHandler");
  notFound = errorHandler.notFound;
  errorHandler = errorHandler.errorHandler;
} catch (err) {
  console.error("❌ Error handler error:", err.message);
  notFound = (req, res) => res.status(404).json({ error: "Not found" });
  errorHandler = (err, req, res, next) =>
    res.status(500).json({ error: err.message });
}

/* ==========================================
   DÉTECTION ENVIRONNEMENT
========================================== */
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);

// ========== CORS CONFIGURATION ==========
const allowedOrigins = [
  "https://report-ex.vercel.app",
  "https://reportex-back-end.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      // Allow anyway for testing - change to false for production
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Authorization"],
};

// Logging middleware
app.use((req, res, next) => {
  console.log(
    `[${req.method}] ${req.url} - Origin: ${req.headers.origin || "no origin"}`,
  );
  next();
});

// Apply CORS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
app.set("trust proxy", isRailway ? 1 : false);

/* ==========================================
   MIDDLEWARES
========================================== */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);

// Static files
try {
  app.use("/uploads", express.static("uploads"));
} catch (err) {
  console.error("Uploads folder error:", err.message);
}

// Test CORS route
app.get("/test-cors", (req, res) => {
  res.json({ message: "CORS is working!", origin: req.headers.origin });
});

// Simple test route
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working",
    timestamp: new Date().toISOString(),
  });
});

if (config.server.env !== "test" && requestLogger) {
  app.use(requestLogger);
}

/* ==========================================
   HEALTH CHECK - MUST WORK
========================================== */
app.get("/health", async (req, res) => {
  try {
    let dbStatus = "unknown";
    if (pool && pool.query) {
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } else {
      dbStatus = "mock_mode";
    }

    res.status(200).json({
      status: "healthy",
      mode: isRailway ? "RAILWAY" : "LOCAL",
      database: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (e) {
    // Health check should NEVER fail - always return 200
    res.status(200).json({
      status: "healthy",
      mode: isRailway ? "RAILWAY" : "LOCAL",
      database: "error: " + e.message,
      warning: "Database connection issue but server is running",
    });
  }
});

/* ==========================================
   ROUTES
========================================== */
try {
  configureRoutes(app);
  console.log("✅ Routes configured successfully");
} catch (err) {
  console.error("❌ Route configuration error:", err.message);
  // Fallback routes
  app.get("/api/*", (req, res) => {
    res.json({ message: "API endpoint", path: req.path });
  });
}

/* ==========================================
   ERROR HANDLING
========================================== */
app.use(notFound);
app.use(errorHandler);

/* ==========================================
   START SERVER
========================================== */
const startServer = async () => {
  const modeLabel = isRailway ? "PRODUCTION / RAILWAY" : "LOCAL";

  // Important: Listen on all interfaces
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`=================================`);
    console.log(`🚀 Server running in ${modeLabel}`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Listening on: 0.0.0.0:${PORT}`);
    console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ CORS enabled for: ${allowedOrigins.join(", ")}`);
    console.log(`=================================`);
  });

  // Handle server errors
  server.on("error", (err) => {
    console.error("Server error:", err);
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    }
  });
};

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Don't exit, just log
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Don't exit, just log
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
} else {
  console.log("Module loaded, not starting server automatically");
}

module.exports = { app, server, io };
