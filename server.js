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
const { pool, closePool } = require("./src/config/database");
const logger = require("./src/utils/logger");
const configureRoutes = require("./src/routes");
const { requestLogger, requestId } = require("./src/middleware/requestLogger");
const { generalLimiter } = require("./src/middleware/rateLimiter");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  pink: "\x1b[35m",
};

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  },
});

app.set("io", io);
app.set("trust proxy", isRailway ? 1 : false);

/* ==========================================
   CORS — ABSOLUTE FIRST, before everything
   ========================================== */
const ALLOWED_ORIGINS = [
  "https://report-ex.vercel.app",
  "https://reportex-back-end.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

// Raw CORS headers — bypasses any middleware ordering issue
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,PATCH,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,Authorization",
  );

  // Respond immediately to preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// cors() package as secondary layer (belt + suspenders)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  }),
);
app.options("*", (req, res) => res.sendStatus(200));

/* ==========================================
   Core middlewares
   ========================================== */
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (config.server.env !== "test") app.use(requestLogger);

/* ==========================================
   Debug log (remove after confirming CORS works)
   ========================================== */
app.use((req, res, next) => {
  console.log(
    `[${req.method}] ${req.path} — origin: ${req.headers.origin || "none"}`,
  );
  next();
});

/* ==========================================
   Routes
   ========================================== */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      mode: isRailway ? "RAILWAY" : "LOCAL",
      cors_origins: ALLOWED_ORIGINS,
    });
  } catch (e) {
    res.status(503).json({ status: "unhealthy" });
  }
});

configureRoutes(app);
app.use(notFound);
app.use(errorHandler);

/* ==========================================
   Server startup
   ========================================== */
const startServer = async () => {
  const modeLabel = isRailway ? "PRODUCTION / RAILWAY" : "LOCAL";

  console.log(
    `\n${colors.pink}╔══════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.pink}║    🏠 MODE ${modeLabel.padEnd(19)} ║${colors.reset}`,
  );
  console.log(
    `${colors.pink}╚══════════════════════════════════════════╝${colors.reset}\n`,
  );

  server.listen(PORT, () => {
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.green}| 🚀 SERVEUR BATEX DÉMARRÉ${colors.reset}`);
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.cyan}| 📍 Environnement : ${modeLabel}`);
    console.log(`${colors.magenta}| 🔌 Port : ${PORT}`);
    console.log(
      `${colors.yellow}| 🔒 CORS origins : ${ALLOWED_ORIGINS.join(", ")}`,
    );

    if (isRailway) {
      console.log(
        `${colors.blue}| 🌍 URL Cloud : ${process.env.RAILWAY_STATIC_URL || "Active"}`,
      );
    } else {
      console.log(`${colors.yellow}| 🌐 API Locale : http://localhost:${PORT}`);
    }
    console.log(
      `${colors.pink}|═══════════════════════════════════════════${colors.reset}\n`,
    );
  });
};

if (require.main === module) startServer();

module.exports = { app, server, io };
