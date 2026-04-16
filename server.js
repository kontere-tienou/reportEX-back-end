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
const configureRoutes = require("./src/routes");
const { requestLogger, requestId } = require("./src/middleware/requestLogger");
const { generalLimiter } = require("./src/middleware/rateLimiter");
const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || config.server.port || 5008;
const isProd = process.env.NODE_ENV === "production";

/* ==========================================
   CORS - Autorise Vercel et le Local
========================================== */
const allowedOrigins = config.cors.origin || [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
      if (isAllowed) return callback(null, true);
      callback(new Error("CORS bloqué"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

app.options("*", cors());

/* ==========================================
   MIDDLEWARES & ROUTES
========================================== */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(generalLimiter);
app.use("/uploads", express.static("uploads"));

if (!isProd) app.use(requestLogger);

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", env: isProd ? "production" : "development" });
  } catch (e) {
    res.status(503).json({ status: "error", message: e.message });
  }
});

configureRoutes(app);

app.use(notFound);
app.use(errorHandler);

/* ==========================================
   START
========================================== */
server.listen(PORT, () => {
  console.log(`🚀 SERVEUR DÉMARRÉ [${isProd ? "PROD" : "LOCAL"}]`);
  console.log(`📍 Port : ${PORT}`);
  if (!isProd)
    console.log(`🌐 Frontend attendu : https://report-ex.vercel.app`);
});

module.exports = { app, server };
