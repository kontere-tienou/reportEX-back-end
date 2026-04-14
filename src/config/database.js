const { Pool } = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

// Load .env.local if it exists (local dev override)
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

const isRailway = !!(
  process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL
);

const dbConfig = isRailway
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    }
  : {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "batex_reporting",
      ssl: false,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    };

console.log(
  isRailway
    ? `${colors.green}🚀 Mode PRODUCTION - Connexion via DATABASE_URL${colors.reset}`
    : `${colors.cyan}💻 Mode LOCAL - Connexion à PostgreSQL${colors.reset}`,
);

if (!isRailway) {
  console.log(
    `${colors.cyan}📊 Base: ${dbConfig.database} sur ${dbConfig.host}:${dbConfig.port}${colors.reset}`,
  );
}

const pool = new Pool(dbConfig);

// Test connection on startup
(async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log(
      isRailway
        ? `${colors.green}✅ CLOUD DB : Connecté à Railway (Postgres)${colors.reset}`
        : `${colors.cyan}💻 LOCAL DB : Connecté à ${dbConfig.database} (localhost)${colors.reset}`,
    );
  } catch (err) {
    console.error(`${colors.red}❌ ERREUR DB : ${err.message}${colors.reset}`);
    // Don't crash — let the app start, individual requests will fail gracefully
  }
})();

pool.on("error", (err) => {
  console.error(
    `${colors.red}❌ Erreur pool DB : ${err.message}${colors.reset}`,
  );
  logger.error("Pool DB error", { message: err.message });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: async () => {
    await pool.end();
    console.log(`${colors.yellow}🔄 Pool DB fermé${colors.reset}`);
  },
};
