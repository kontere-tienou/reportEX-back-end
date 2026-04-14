// src/config/database.js
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

// Chargement .env.local si existe
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

/* ==========================================
  CONFIGURATION DYNAMIQUE (LOCAL / RAILWAY)
  ==========================================
*/

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;

const dbConfig = isRailway
  ? {
      // Version Production (Railway)
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    }
  : {
      // Version Développement (Local)
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "batex_reporting",
      ssl: false,
    };

// Options communes
dbConfig.max = 10;
dbConfig.connectionTimeoutMillis = 10000;

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

// Création du pool
const pool = new Pool(dbConfig);

// Test de connexion immédiat
(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT NOW()");
    console.log(
      `${colors.green}✅ Connexion à la base de données établie${colors.reset}`,
    );
  } catch (err) {
    console.log(
      `${colors.red}❌ Erreur de connexion DB : ${err.message}${colors.reset}`,
    );
    if (!isRailway) {
      console.log(
        `${colors.yellow}⚠️  Vérifiez que PostgreSQL est démarré localement.${colors.reset}`,
      );
    } else {
      console.log(
        `${colors.red}❗ Vérifiez la variable DATABASE_URL sur Railway.${colors.reset}`,
      );
    }
    logger.error("❌ Erreur DB", { message: err.message });
  } finally {
    if (client) client.release();
  }
})();

// Gestion des erreurs
pool.on("error", (err) => {
  console.log(`${colors.red}❌ Erreur pool DB : ${err.message}${colors.reset}`);
  logger.error("❌ Erreur pool DB", { message: err.message });
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: async () => {
    await pool.end();
    console.log(`${colors.yellow}🔄 Pool DB fermé${colors.reset}`);
  },
};
