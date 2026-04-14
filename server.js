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

/*
 ==========================================
  BATEX ERP - CONFIGURATION DYNAMIQUE
 ==========================================
*/

// SYNCHRONISATION : On utilise la même logique que dans database.js
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set("io", io);
app.set("trust proxy", isRailway ? 1 : false);

app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (config.server.env !== "test") {
  app.use(requestLogger);
}

// Routes Health
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      mode: isRailway ? "PRODUCTION" : "LOCAL",
      database: "connected",
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({ status: "unhealthy", error: error.message });
  }
});

configureRoutes(app);
app.use(notFound);
app.use(errorHandler);

// --- Socket.IO ---
const connectedUsers = new Map();
io.on("connection", (socket) => {
  socket.on("authenticate", (userId) => {
    if (!userId) return;
    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
  });
  socket.on("disconnect", () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

/**
 * ==========================================
 * DÉMARRAGE DU SERVEUR
 * ==========================================
 */

const startServer = async () => {
  try {
    const modeLabel = isRailway ? "PRODUCTION / RAILWAY" : "LOCAL";

    // 1. Affichage de l'entête
    console.log(
      `\n${colors.pink}╔══════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.pink}║    🚀 MODE ${modeLabel.padEnd(19)} ║${colors.reset}`,
    );
    console.log(
      `${colors.pink}╚══════════════════════════════════════════╝${colors.reset}\n`,
    );

    // 2. Lancement du serveur
    server.listen(PORT, () => {
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
      );
      console.log(
        `${colors.green}| ✅ SERVEUR BATEX OPÉRATIONNEL${colors.reset}`,
      );
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
      );
      console.log(
        `${colors.cyan}| 📍 Environnement : ${isRailway ? "CLOUD (Railway)" : "DEVELOPPEMENT (Local)"}`,
      );
      console.log(`${colors.magenta}| 🔌 Port : ${PORT}`);

      if (!isRailway) {
        console.log(`${colors.yellow}| 🌐 API : http://localhost:${PORT}`);
      } else {
        console.log(
          `${colors.blue}| 🌍 URL : ${process.env.RAILWAY_STATIC_URL || "Railway Cloud"}`,
        );
      }

      console.log(`${colors.green}| 💓 Health Check : Activé`);
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}\n`,
      );
    });
  } catch (error) {
    logger.error("❌ Échec critique:", error.message);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n${colors.yellow}🔄 Arrêt (${signal})...${colors.reset}`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
