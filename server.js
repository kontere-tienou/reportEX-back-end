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

/**
 * ==========================================
 * BATEX ERP - SERVER CONFIGURATION
 * ==========================================
 */

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach io to app for use in controllers
app.set("io", io);

/**
 * ==========================================
 * MIDDLEWARE CONFIGURATION
 * ==========================================
 */

// Security & Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Request ID
app.use(requestId);

// Request logging
if (config.server.env !== "test") {
  app.use(requestLogger);
}

// Rate limiting
app.use(generalLimiter);

// Static files (uploads)
app.use("/uploads", express.static("uploads"));

/**
 * ==========================================
 * ROUTES CONFIGURATION
 * ==========================================
 */

configureRoutes(app);

/**
 * ==========================================
 * ERROR HANDLING
 * ==========================================
 */

// 404 Not Found
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

/**
 * ==========================================
 * SOCKET.IO CONFIGURATION
 * ==========================================
 */

// Store connected users
const connectedUsers = new Map();

io.on("connection", (socket) => {
  logger.info("Socket.IO: New client connected", {
    socketId: socket.id,
    ip: socket.handshake.address,
  });

  /**
   * User authentication and room join
   */
  socket.on("authenticate", (userId) => {
    if (!userId) {
      logger.warn("Socket.IO: Authentication failed - no userId");
      return;
    }

    // Store user connection
    connectedUsers.set(userId, socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    logger.info("Socket.IO: User authenticated", {
      userId,
      socketId: socket.id,
    });

    // Send confirmation
    socket.emit("authenticated", {
      success: true,
      userId,
      socketId: socket.id,
    });

    // Broadcast user online status
    io.emit("user:online", { userId });
  });

  /**
   * Join department room
   */
  socket.on("join:department", (departmentId) => {
    if (!departmentId) return;

    socket.join(`department:${departmentId}`);

    logger.info("Socket.IO: Joined department room", {
      departmentId,
      socketId: socket.id,
    });
  });

  /**
   * Leave department room
   */
  socket.on("leave:department", (departmentId) => {
    if (!departmentId) return;

    socket.leave(`department:${departmentId}`);

    logger.info("Socket.IO: Left department room", {
      departmentId,
      socketId: socket.id,
    });
  });

  /**
   * Real-time notification
   */
  socket.on("notification:send", (data) => {
    const { userId, notification } = data;

    if (!userId || !notification) {
      logger.warn("Socket.IO: Invalid notification data");
      return;
    }

    // Send to specific user
    io.to(`user:${userId}`).emit("notification:new", notification);

    logger.info("Socket.IO: Notification sent", {
      userId,
      type: notification.type,
    });
  });

  /**
   * Typing indicator
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
   * Disconnect handler
   */
  socket.on("disconnect", () => {
    // Find and remove user from connected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);

        // Broadcast user offline status
        io.emit("user:offline", { userId });

        logger.info("Socket.IO: User disconnected", {
          userId,
          socketId: socket.id,
        });
        break;
      }
    }

    logger.info("Socket.IO: Client disconnected", {
      socketId: socket.id,
    });
  });

  /**
   * Error handler
   */
  socket.on("error", (error) => {
    logger.error("Socket.IO: Socket error", {
      socketId: socket.id,
      error: error.message,
    });
  });
});

/**
 * ==========================================
 * DATABASE CONNECTION CHECK
 * ==========================================
 */

const checkDatabase = async () => {
  try {
    await pool.query("SELECT NOW()");
    logger.info("✅ Database connection successful");
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed:", error);
    return false;
  }
};

/**
 * ==========================================
 * SERVER STARTUP
 * ==========================================
 */

const startServer = async () => {
  try {
    // Check database connection
    const dbConnected = await checkDatabase();

    if (!dbConnected) {
      logger.error("Cannot start server - database connection failed");
      process.exit(1);
    }

    // Start server
    const PORT = config.server.port;

    server.listen(PORT, () => {
      logger.info("==========================================");
      logger.info("🚀 BATEX ERP SERVER STARTED");
      logger.info("==========================================");
      logger.info(`Environment: ${config.server.env}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`API URL: http://localhost:${PORT}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
      logger.info(`Socket.IO: Enabled`);
      logger.info("==========================================");
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

/**
 * ==========================================
 * GRACEFUL SHUTDOWN
 * ==========================================
 */

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed");

    try {
      // Close database pool
      await closePool();
      logger.info("Database pool closed");

      // Close Socket.IO connections
      io.close(() => {
        logger.info("Socket.IO server closed");
      });

      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

/**
 * ==========================================
 * START THE SERVER
 * ==========================================
 */

if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, server, io };
