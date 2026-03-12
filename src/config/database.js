const { Pool } = require("pg");
require("dotenv").config();

const logger = require("../utils/logger");

// ────────────────────────────────────────────────
//  Debug environment at startup (using logger)
// ────────────────────────────────────────────────
logger.info("🚀 Environment debug at startup", {
  NODE_ENV: process.env.NODE_ENV || "(not set)",
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || "no",
  isRailway:
    !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_SERVICE_ID,
  DATABASE_URL_present: !!process.env.DATABASE_URL,
  DATABASE_URL_preview: process.env.DATABASE_URL
    ? process.env.DATABASE_URL.substring(0, 45) + "..."
    : "(not set)",
  DB_HOST: process.env.DB_HOST || "(not set)",
  DB_PORT: process.env.DB_PORT || "(not set)",
});

// ────────────────────────────────────────────────
//  Configuration strategy
// ────────────────────────────────────────────────
let dbConfig;

const isRailway =
  !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_SERVICE_ID;

if (process.env.DATABASE_URL) {
  logger.info("📊 Using DATABASE_URL (recommended for Railway / production)");

  const isInternal = process.env.DATABASE_URL.includes(".railway.internal");

  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isInternal ? false : { rejectUnauthorized: false }, // internal = trusted SSL; public = self-signed → disable verify
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else if (
  process.env.DB_HOST ||
  process.env.DB_USER ||
  process.env.DB_PASSWORD ||
  process.env.DB_NAME
) {
  logger.info("📊 Using individual DB variables (local/development fallback)");

  dbConfig = {
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "railway",
    ssl: isRailway ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else {
  logger.error("❌ No database configuration found!", {
    advice:
      "Set DATABASE_URL (preferred on Railway) or individual DB_* variables",
  });
  process.exit(1);
}

// ────────────────────────────────────────────────
//  Create pool
// ────────────────────────────────────────────────
const pool = new Pool(dbConfig);

pool.on("connect", () => {
  logger.info("✅ PostgreSQL client connected");
});

pool.on("error", (err, client) => {
  logger.error("❌ Unexpected error on idle PostgreSQL client", {
    message: err.message,
    stack: err.stack,
  });
});

// ────────────────────────────────────────────────
//  Initial health check (async IIFE)
// ────────────────────────────────────────────────
(async () => {
  let client;
  try {
    client = await pool.connect();
    logger.info("✅ Initial connection test successful");

    const nowRes = await client.query("SELECT NOW() as now");
    logger.info("🕒 Database server time", { time: nowRes.rows[0].now });

    const tablesRes = await client.query(`
      SELECT COUNT(*) AS count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    logger.info("📊 Public tables found", { count: tablesRes.rows[0].count });
  } catch (err) {
    logger.error("❌ Database connection / health check failed", {
      message: err.message,
      code: err.code,
      stack:
        err.stack?.substring(0, 300) + (err.stack?.length > 300 ? "..." : ""),
    });

    if (isRailway) {
      logger.warn(
        "⚠️ Running on Railway – ensure DATABASE_URL is set via reference ${{Postgres.DATABASE_URL}} in service variables",
      );
    }
    // Do NOT exit in production – degrade gracefully
  } finally {
    if (client) client.release();
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: async () => {
    logger.info("Closing PostgreSQL connection pool...");
    await pool.end();
    logger.info("PostgreSQL pool closed");
  },
};
