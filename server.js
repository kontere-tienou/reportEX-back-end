// server.js - UPDATED CORS CONFIGURATION
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

/* ==========================================
   DÉTECTION ENVIRONNEMENT
========================================== */
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);

// ========== UPDATED CORS CONFIGURATION ==========
const allowedOrigins = [
  "https://report-ex.vercel.app",
  "https://reportex-back-end.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // For legacy browser support
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
// Add this BEFORE your CORS middleware in server.js
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', req.headers);
  next();
});

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// Socket.IO with CORS
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
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

// Add a test CORS route
app.get("/test-cors", (req, res) => {
  res.json({ message: "CORS is working!", origin: req.headers.origin });
});

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
      mode: isRailway ? "RAILWAY" : "LOCAL",
    });
  } catch (e) {
    res.status(503).json({ status: "unhealthy" });
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
  const modeLabel = isRailway ? "PRODUCTION / RAILWAY" : "LOCAL";

  server.listen(PORT, () => {
    console.log(`🚀 Server running in ${modeLabel}`);
    console.log(`📍 Port: ${PORT}`);

    if (isRailway) {
      console.log(
        `🌍 Cloud URL: ${process.env.RAILWAY_STATIC_URL || "Active"}`,
      );
    } else {
      console.log(`🌐 Local: http://localhost:${PORT}`);
    }
  });
};

if (require.main === module) startServer();

module.exports = { app, server, io };
