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

/* ==========================================
   DÉTECTION UNIQUE (RAILWAY VS LOCAL)
   ========================================== */
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.cors.origin, credentials: true },
});

app.set("io", io);
app.set("trust proxy", isRailway ? 1 : false);

// Middlewares de base
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (config.server.env !== "test") app.use(requestLogger);

// Routes
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", mode: isRailway ? "RAILWAY" : "LOCAL" });
  } catch (e) {
    res.status(503).json({ status: "unhealthy" });
  }
});

configureRoutes(app);
app.use(notFound);
app.use(errorHandler);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log("Request origin:", origin);
  console.log("Allowed origins:", config.cors.origin);

  if (config.cors.origin.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
/* ==========================================
   DÉMARRAGE SYNCHRONISÉ
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
