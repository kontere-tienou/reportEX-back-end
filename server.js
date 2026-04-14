const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const {
  ALLOWED_ORIGINS,
  server: serverConfig,
} = require("./src/config/config");
const { pool } = require("./src/config/database");
const logger = require("./src/utils/logger");
const configureRoutes = require("./src/routes");
const { requestLogger, requestId } = require("./src/middleware/requestLogger");
const { generalLimiter } = require("./src/middleware/rateLimiter");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  pink: "\x1b[35m",
};

const isRailway = !!(
  process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL
);
const PORT = process.env.PORT || serverConfig.port || 5008;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  },
});

app.set("io", io);
app.set("trust proxy", isRailway ? 1 : false);

/* ══════════════════════════════════════════
   1. CORS — must be absolutely first
   ══════════════════════════════════════════ */

// Layer 1: raw headers (catches everything including edge cases)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,Authorization",
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Layer 2: cors() package
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  }),
);

// Explicit preflight catch-all
app.options("*", (req, res) => res.sendStatus(200));

/* ══════════════════════════════════════════
   2. Security & core middlewares
   ══════════════════════════════════════════ */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false, // critical — prevents helmet blocking cross-origin responses
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (serverConfig.env !== "test") app.use(requestLogger);

/* ══════════════════════════════════════════
   3. Health check (before all routes)
   ══════════════════════════════════════════ */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      env: serverConfig.env,
      mode: isRailway ? "RAILWAY" : "LOCAL",
      port: PORT,
      allowed_origins: ALLOWED_ORIGINS,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(503).json({ status: "unhealthy", error: e.message });
  }
});

/* ══════════════════════════════════════════
   4. API routes
   ══════════════════════════════════════════ */
configureRoutes(app);

/* ══════════════════════════════════════════
   5. Error handlers — always last
   ══════════════════════════════════════════ */
app.use(notFound);
app.use(errorHandler);

/* ══════════════════════════════════════════
   6. Start
   ══════════════════════════════════════════ */
const startServer = () => {
  const modeLabel = isRailway ? "PRODUCTION / RAILWAY" : "LOCAL";

  server.listen(PORT, () => {
    console.log(
      `\n${colors.pink}╔══════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.pink}║    🏠 MODE ${modeLabel.padEnd(19)} ║${colors.reset}`,
    );
    console.log(
      `${colors.pink}╚══════════════════════════════════════════╝${colors.reset}`,
    );
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.green}| 🚀 SERVEUR BATEX DÉMARRÉ${colors.reset}`);
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.cyan}| 📍 Environnement : ${modeLabel}`);
    console.log(`${colors.magenta}| 🔌 Port         : ${PORT}`);
    console.log(`${colors.cyan}| 🔒 CORS origins :`);
    ALLOWED_ORIGINS.forEach((o) =>
      console.log(`${colors.cyan}|    • ${o}${colors.reset}`),
    );
    if (isRailway) {
      console.log(
        `${colors.blue}| 🌍 URL          : https://${process.env.RAILWAY_STATIC_URL || "railway.app"}${colors.reset}`,
      );
    } else {
      console.log(
        `${colors.yellow}| 🌐 Local        : http://localhost:${PORT}${colors.reset}`,
      );
    }
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}\n`,
    );
  });
};

if (require.main === module) startServer();

module.exports = { app, server, io };
