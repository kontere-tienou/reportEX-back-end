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

/*
 ==========================================
  BATEX ERP - CONFIGURATION DU SERVEUR
==========================================
 */
const isRailway = !!process.env.RAILWAY_SERVICE_ID;
logger.info("🚀 Démarrage du serveur avec la configuration suivante :", {
  isRailway,
});
// Override config for Railway if needed
if (isRailway) {
  console.log("🚂 Running on Railway - adjusting configuration");
  
  // Ensure we use Railway-assigned port
  process.env.PORT = process.env.PORT || '5008';
  
  // Log all Railway-specific env vars
  console.log("Railway specific:");
  console.log("- RAILWAY_PUBLIC_DOMAIN:", process.env.RAILWAY_PUBLIC_DOMAIN);
  console.log("- RAILWAY_PRIVATE_DOMAIN:", process.env.RAILWAY_PRIVATE_DOMAIN);
  console.log("- RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);
}

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

// Attacher io à l'app pour utilisation dans les contrôleurs
app.set("io", io);

/**
  ==========================================
  CONFIGURATION DES MIDDLEWARES
  ==========================================
 */

app.use(
  helmet({
    contentSecurityPolicy: false,
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

if (config.server.env !== "test") {
  app.use(requestLogger);
}

app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));


app.get("/api/reports/builder", async (req, res) => {
  try {
    res.status(200).json({ message: "Report Builder Initialized" });
  } catch (error) {
    console.error("Error initializing report builder:", error);
    res.status(500).json({ message: "Error initializing report builder" });
  }
});

configureRoutes(app);

// 404 Non Trouvé
app.use(notFound);

// Gestionnaire d'erreurs global
app.use(errorHandler);

const connectedUsers = new Map();

io.on("connection", (socket) => {
  logger.info("Socket.IO : Nouveau client connecté", {
    socketId: socket.id,
    ip: socket.handshake.address,
  });

  /**
   * Authentification de l'utilisateur et adhésion aux salles
   */
  socket.on("authenticate", (userId) => {
    if (!userId) {
      logger.warn("Socket.IO : Échec d'authentification - userId manquant");
      return;
    }

    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);

    logger.info("Socket.IO : Utilisateur authentifié", {
      userId,
      socketId: socket.id,
    });

    socket.emit("authenticated", {
      success: true,
      userId,
      socketId: socket.id,
      message: "Authentification réussie",
    });

    // Diffuser le statut en ligne
    io.emit("user:online", { userId });
  });

  /**
   * Rejoindre une salle de département
   */
  socket.on("join:department", (departmentId) => {
    if (!departmentId) return;
    socket.join(`department:${departmentId}`);
    logger.info("Socket.IO : Salle de département rejointe", {
      departmentId,
      socketId: socket.id,
    });
  });

  /**
   * Quitter une salle de département
   */
  socket.on("leave:department", (departmentId) => {
    if (!departmentId) return;
    socket.leave(`department:${departmentId}`);
    logger.info("Socket.IO : Salle de département quittée", {
      departmentId,
      socketId: socket.id,
    });
  });

  /**
   * Notification en temps réel
   */
  socket.on("notification:send", (data) => {
    const { userId, notification } = data;

    if (!userId || !notification) {
      logger.warn("Socket.IO : Données de notification invalides");
      return;
    }

    io.to(`user:${userId}`).emit("notification:new", notification);
    logger.info("Socket.IO : Notification envoyée", {
      userId,
      type: notification.type,
    });
  });

  /**
   * Indicateurs de saisie
   */
  socket.on("typing:start", (data) => {
    const { room, userId, userName } = data;
    socket.to(room).emit("typing:user", { userId, userName, typing: true });
  });

  socket.on("typing:stop", (data) => {
    const { room, userId } = data;
    socket.to(room).emit("typing:user", { userId, typing: false });
  });

  /**
   * Gestion de la déconnexion
   */
  socket.on("disconnect", () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        io.emit("user:offline", { userId });
        logger.info("Socket.IO : Utilisateur déconnecté", {
          userId,
          socketId: socket.id,
        });
        break;
      }
    }
    logger.info("Socket.IO : Client déconnecté", { socketId: socket.id });
  });

  socket.on("error", (error) => {
    logger.error("Socket.IO : Erreur de socket", {
      socketId: socket.id,
      error: error.message,
    });
  });
});

/**
 * ==========================================
 * VÉRIFICATION DE LA BASE DE DONNÉES
 * ==========================================
 */

const checkDatabase = async () => {
  try {
    await pool.query("SELECT NOW()");
    logger.info("✅ Connexion à la base de données réussie");
    return true;
  } catch (error) {
    logger.error("❌ Échec de la connexion à la base de données :", error);
    return false;
  }
};

/**
 * ==========================================
 * DÉMARRAGE DU SERVEUR
 * ==========================================
 */

const startServer = async () => {
  try {
    const dbConnected = await checkDatabase();

    if (!dbConnected) {
      logger.error("Impossible de démarrer le serveur - Échec connexion DB");
      process.exit(1);
    }

    const PORT = config.server.port;

    server.listen(PORT, () => {
      logger.info("==========================================");
      logger.info("🚧 SERVEUR BATEX ERP DÉMARRÉ");
      logger.info("==========================================");
      logger.info(`Environnement : ${config.server.env}`);
      logger.info(`Port : ${PORT}`);
      logger.info(`URL API : http://localhost:${PORT}`);
      logger.info(`Santé : http://localhost:${PORT}/health`);
      logger.info(`Socket.IO : Activé`);
      logger.info("==========================================");
    });
  } catch (error) {
    logger.error("Échec du démarrage du serveur :", error);
    process.exit(1);
  }
};

/**
 * ==========================================
 * ARRÊT GRACIEUX (GRACEFUL SHUTDOWN)
 * ==========================================
 */

const gracefulShutdown = async (signal) => {
  logger.info(`Signal ${signal} reçu. Début de l'arrêt gracieux...`);

  server.close(async () => {
    logger.info("Serveur HTTP fermé");

    try {
      await closePool();
      logger.info("Pool de base de données fermé");

      io.close(() => {
        logger.info("Serveur Socket.IO fermé");
      });

      logger.info("Arrêt gracieux terminé");
      process.exit(0);
    } catch (error) {
      logger.error("Erreur lors de l'arrêt :", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Arrêt forcé après délai d'attente");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error("Exception non capturée :", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Rejet de promesse non géré à :", promise, "raison :", reason);
  gracefulShutdown("unhandledRejection");
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
