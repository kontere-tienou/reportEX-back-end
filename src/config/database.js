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
  try {
    await pool.query("SELECT NOW()");
    if (isRailway) {
      console.log(
        `${colors.green}✅ CLOUD DB : Connecté à Railway (Postgres)${colors.reset}`,
      );
    } else {
      console.log(
        `${colors.cyan}💻 LOCAL DB : Connecté à ${dbConfig.database} (localhost)${colors.reset}`,
      );
    }
  } catch (err) {
    console.log(`${colors.red}❌ ERREUR DB : ${err.message}${colors.reset}`);
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
/*

// src/config/database.js
const { Pool } = require("pg");
require("dotenv").config();

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL;

const dbConfig = isRailway 
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Obligatoire pour Railway
    }
  : {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "batex_reporting",
      ssl: false,
    };

const pool = new Pool(dbConfig);

// Test de connexion avec logs adaptés
(async () => {
  try {
    await pool.query("SELECT NOW()");
    if (isRailway) {
      console.log(`${colors.green}✅ CLOUD DB : Connecté à Railway (Postgres)${colors.reset}`);
    } else {
      console.log(`${colors.cyan}💻 LOCAL DB : Connecté à ${dbConfig.database} (localhost)${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}❌ ERREUR DB : ${err.message}${colors.reset}`);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: () => pool.end(),
};

*/