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

// Couleurs pour les logs console
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

// Détection automatique : Railway définit souvent RAILWAY_ENVIRONMENT ou NODE_ENV=production
const isRailway =
  process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production";
const PORT = process.env.PORT || config.server.port || 5008;

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO
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

// Important pour Railway : Faire confiance au proxy pour récupérer l'IP réelle
app.set("trust proxy", isRailway ? 1 : false);

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Requis pour certains outils de reporting/dashboards
    crossOriginEmbedderPolicy: false,
  }),
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

// --- Routes Spécifiques ---

app.get("/api/reports/builder", async (req, res) => {
  try {
    res.status(200).json({ message: "Report Builder Initialized" });
  } catch (error) {
    logger.error("❌ Erreur report builder", { error: error.message });
    res.status(500).json({ message: "Error initializing report builder" });
  }
});

// Route health check (Crucial pour Railway)
app.get("/health", async (req, res) => {
  try {
    const dbTest = await pool.query("SELECT 1 as connected");
    res.json({
      status: "healthy",
      mode: isRailway ? "PRODUCTION/RAILWAY" : "LOCAL",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      mode: isRailway ? "PRODUCTION/RAILWAY" : "LOCAL",
      database: "disconnected",
      error: error.message,
    });
  }
});

// Chargement des autres routes
configureRoutes(app);

// Gestion des erreurs
app.use(notFound);
app.use(errorHandler);

// --- Socket.IO Logic ---
const connectedUsers = new Map();

io.on("connection", (socket) => {
  logger.info("📱 Client Socket.IO connecté", { socketId: socket.id });

  socket.on("authenticate", (userId) => {
    if (!userId) return;
    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    io.emit("user:online", { userId });
    logger.info("👤 Utilisateur authentifié", { userId });
  });

  socket.on("join:department", (departmentId) => {
    if (!departmentId) return;
    socket.join(`department:${departmentId}`);
  });

  socket.on("notification:send", (data) => {
    const { userId, notification } = data;
    if (!userId || !notification) return;
    io.to(`user:${userId}`).emit("notification:new", notification);
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        io.emit("user:offline", { userId });
        break;
      }
    }
    logger.info("📱 Client Socket.IO déconnecté", { socketId: socket.id });
  });
});

/**
 * ==========================================
 * DÉMARRAGE DU SERVEUR
 * ==========================================
 */

const startServer = async () => {
  try {
    // Entête de démarrage
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

    // Vérification DB
    try {
      await pool.query("SELECT NOW()");
      console.log(`${colors.green}✅ Base de données connectée${colors.reset}`);
    } catch (dbError) {
      console.log(
        `${colors.red}❌ Échec connexion DB:${colors.reset} ${dbError.message}`,
      );
      if (!isRailway) {
        console.log(
          `${colors.yellow}⚠️  Vérifiez que PostgreSQL est lancé localement.${colors.reset}`,
        );
      }
      process.exit(1);
    }

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
      if (!isRailway) {
        console.log(`${colors.yellow}| 🌐 API : http://localhost:${PORT}`);
        console.log(
          `${colors.green}| 💓 Health : http://localhost:${PORT}/health`,
        );
      }
      console.log(`${colors.blue}| 📡 Socket.IO : Activé`);
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}\n`,
      );
    });
  } catch (error) {
    logger.error("❌ Échec critique au démarrage:", error.message);
    process.exit(1);
  }
};

// Arrêt gracieux (Graceful Shutdown)
const gracefulShutdown = async (signal) => {
  console.log(
    `\n${colors.yellow}🔄 Arrêt du serveur (${signal})...${colors.reset}`,
  );
  server.close(async () => {
    await closePool();
    io.close();
    console.log(
      `${colors.green}✅ Ressources libérées et serveur arrêté${colors.reset}`,
    );
    process.exit(0);
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
