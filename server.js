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
  BATEX ERP - CONFIGURATION DU SERVEUR (MODE LOCAL)
==========================================
 */

// Désactiver Railway - Forcer le mode local
const isRailway = true; // Toujours false pour forcer le mode local
process.env.PORT = process.env.PORT || "5008";

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

// Configuration trust proxy simplifiée pour local
app.set("trust proxy", false); // Pas de proxy en local

// Middlewares
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

// Routes
app.get("/api/reports/builder", async (req, res) => {
  try {
    res.status(200).json({ message: "Report Builder Initialized" });
  } catch (error) {
    console.error(
      `${colors.red}❌ Erreur report builder:${colors.reset}`,
      error.message,
    );
    res.status(500).json({ message: "Error initializing report builder" });
  }
});

// Route health check améliorée
app.get("/health", async (req, res) => {
  try {
    const dbTest = await pool.query("SELECT 1 as connected");
    res.json({
      status: "healthy",
      mode: "LOCAL",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      mode: "LOCAL",
      database: "disconnected",
      error: error.message,
    });
  }
});

configureRoutes(app);
app.use(notFound);
app.use(errorHandler);

// Socket.IO
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

  socket.on("leave:department", (departmentId) => {
    if (!departmentId) return;
    socket.leave(`department:${departmentId}`);
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
        logger.info("👤 Utilisateur déconnecté", { userId });
        break;
      }
    }
    logger.info("📱 Client Socket.IO déconnecté", { socketId: socket.id });
  });

  socket.on("error", (error) => {
    logger.error("❌ Erreur Socket.IO", { error: error.message });
  });
});

/**
 * ==========================================
 * VÉRIFICATION DB & DÉMARRAGE
 * ==========================================
 */

const checkDatabase = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log(`${colors.green}✅ Base de données connectée${colors.reset}`);
    return true;
  } catch (error) {
    console.log(
      `${colors.red}❌ Échec connexion DB:${colors.reset}`,
      error.message,
    );
    console.log(
      `${colors.yellow}⚠️  Assurez-vous que PostgreSQL est démarré:${colors.reset}`,
    );
    console.log(
      `${colors.cyan}   - Linux: sudo systemctl start postgresql${colors.reset}`,
    );
    console.log(
      `${colors.cyan}   - Mac: brew services start postgresql${colors.reset}`,
    );
    console.log(
      `${colors.cyan}   - Windows: net start postgresql${colors.reset}`,
    );
    return false;
  }
};

const startServer = async () => {
  try {
    console.log(
      `\n${colors.pink}╔══════════════════════════════════════════╗${colors.reset}`,
    );
    console.log(
      `${colors.pink}║     🏠 MODE LOCAL - DÉMARRAGE           ║${colors.reset}`,
    );
    console.log(
      `${colors.pink}╚══════════════════════════════════════════╝${colors.reset}\n`,
    );

    const dbConnected = await checkDatabase();
    if (!dbConnected) {
      console.log(`${colors.red}❌ Arrêt - Pas de connexion DB${colors.reset}`);
      console.log(
        `${colors.yellow}💡 Solution: Créez la base de données avec:${colors.reset}`,
      );
      console.log(`${colors.cyan}   createdb batex_reporting${colors.reset}`);
      process.exit(1);
    }

    const PORT = config.server.port;
    server.listen(PORT, () => {
      console.log(
        `\n${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
      );
      console.log(
        `${colors.green}|  🚀 SERVEUR DÉMARRÉ (MODE LOCAL)${colors.reset}`,
      );
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}`,
      );
      console.log(`${colors.cyan}|  📍 Environnement : LOCAL`);
      console.log(`${colors.magenta}|  🔌 Port : ${PORT}`);
      console.log(`${colors.yellow}|  🌐 API : http://localhost:${PORT}`);
      console.log(
        `${colors.green}|  💓 Health : http://localhost:${PORT}/health`,
      );
      console.log(`${colors.blue}|  📡 Socket.IO : Activé`);
      console.log(
        `${colors.pink}|═══════════════════════════════════════════${colors.reset}\n`,
      );
    });
  } catch (error) {
    logger.error("❌ Échec démarrage:", error.message);
    process.exit(1);
  }
};

// Arrêt gracieux
const gracefulShutdown = async (signal) => {
  console.log(
    `\n${colors.yellow}🔄 Arrêt du serveur (${signal})...${colors.reset}`,
  );
  logger.info(`Arrêt demandé via ${signal}`);

  server.close(async () => {
    await closePool();
    io.close();
    console.log(`${colors.green}✅ Serveur arrêté${colors.reset}`);
    process.exit(0);
  });

  setTimeout(() => {
    console.log(`${colors.red}❌ Arrêt forcé${colors.reset}`);
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  console.log(
    `${colors.red}❌ Exception non capturée:${colors.reset}`,
    error.message,
  );
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.log(
    `${colors.red}❌ Rejection non gérée:${colors.reset}`,
    reason?.message || reason,
  );
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
