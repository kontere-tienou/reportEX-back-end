// src/config/database.js
const { Pool } = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

// Couleurs pour les logs essentiels
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

// Configuration UNIQUEMENT locale
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "batex_reporting",
  ssl: false, // Pas de SSL en local
  max: 10,
  connectionTimeoutMillis: 10000,
};

console.log(
  `${colors.cyan}💻 Mode LOCAL - Connexion à PostgreSQL${colors.reset}`,
);
console.log(
  `${colors.cyan}📊 Base: ${dbConfig.database} sur ${dbConfig.host}:${dbConfig.port}${colors.reset}`,
);

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
    console.log(
      `${colors.yellow}⚠️  Vérifiez que PostgreSQL est démarré et que les identifiants sont corrects${colors.reset}`,
    );
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
