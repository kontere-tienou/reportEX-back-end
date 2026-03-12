const { Pool } = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

/*
────────────────────────────────────────────────
ENV LOADING STRATEGY
────────────────────────────────────────────────
Priority:
1. .env.local (local development)
2. .env (fallback)
Railway injects variables automatically so no file is needed there
*/

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log("🔧 Loaded environment from .env.local");
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("🔧 Loaded environment from .env");
} else {
  console.log("⚠️ No local env file found (expected on Railway)");
}

// ────────────────────────────────────────────────
// Configuration strategy
// ────────────────────────────────────────────────

let dbConfig;

const isRailway =
  !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_SERVICE_ID;

logger.info("🚀 Environment debug", {
  NODE_ENV: process.env.NODE_ENV,
  isRailway,
  DATABASE_URL_present: !!process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST || "(not set)",
});

// ────────────────────────────────────────────────
// DATABASE_URL (production / Railway)
// ────────────────────────────────────────────────

if (process.env.DATABASE_URL) {
  logger.info("📊 Using DATABASE_URL");

  const isInternal = process.env.DATABASE_URL.includes(".railway.internal");

  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isInternal ? false : { rejectUnauthorized: false },
    max: 10, // safer pool size for Railway
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// ────────────────────────────────────────────────
// Individual DB variables (local fallback)
// ────────────────────────────────────────────────
else if (
  process.env.DB_HOST ||
  process.env.DB_USER ||
  process.env.DB_PASSWORD ||
  process.env.DB_NAME
) {
  logger.info("📊 Using individual DB variables");

  dbConfig = {
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "postgres",
    ssl: isRailway ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else {
  logger.error("❌ No database configuration found!", {
    advice:
      "Define DATABASE_URL (Railway) or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (local)",
  });

  process.exit(1);
}

// ────────────────────────────────────────────────
// Create pool
// ────────────────────────────────────────────────

const pool = new Pool(dbConfig);

pool.on("connect", () => {
  logger.info("✅ PostgreSQL client connected");
});

pool.on("error", (err) => {
  logger.error("❌ Unexpected PostgreSQL error", {
    message: err.message,
    stack: err.stack,
  });
});

// ────────────────────────────────────────────────
// Health check
// ────────────────────────────────────────────────

(async () => {
  let client;

  try {
    client = await pool.connect();

    const res = await client.query("SELECT NOW()");
    logger.info("🕒 Database connected", {
      serverTime: res.rows[0].now,
    });
  } catch (err) {
    logger.error("❌ Database health check failed", {
      message: err.message,
      code: err.code,
    });
  } finally {
    if (client) client.release();
  }
})();

// ────────────────────────────────────────────────

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: async () => {
    logger.info("Closing PostgreSQL pool...");
    await pool.end();
    logger.info("PostgreSQL pool closed");
  },
};
