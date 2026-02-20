const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config({ path: ".env.local" });

const app = express();
const server = http.createServer(app);

// Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ===========================
 * Socket.IO: Rooms par userId
 * ===========================
 * Frontend doit faire: socket.emit("join", { userId })
 */
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join", ({ userId }) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
    console.log(`✅ user ${userId} joined room user:${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// Export io pour l’utiliser dans services (notification/report/etc.)
app.set("io", io);

// Routes
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const reportRoutes = require("./src/routes/reportRoutes");
const departmentRoutes = require("./src/routes/departmentRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const managementRoutes = require("./src/routes/namagmentRoutes");
const itRoutes = require("./src/routes/itRoute");
const reportAccessRequestRoutes = require("./src/routes/reportAccessRequestRoutes");
const reportCommentRoutes = require("./src/routes/reportCommentRoutes");

app.use("/api/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/it", itRoutes);
app.use("/api/report-access", reportAccessRequestRoutes);

app.use("/api/reports", reportCommentRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "BATEX-CI Reporting API is running",
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route non trouvée" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5008;

//server.listen
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║ BATEX-CI REPORTING SYSTEM API                     ║
║ Serveur démarré sur le port ${PORT}                  ║
║ Environment: ${process.env.NODE_ENV || "development"}                          ║
║ URL: http://localhost:${PORT}                        ║
╚═══════════════════════════════════════════════════╝
`);
});

module.exports = app;
