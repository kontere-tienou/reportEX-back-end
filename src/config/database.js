const { Pool } = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

// Chargement auto des variables
const envPath = path.resolve(
  process.cwd(),
  fs.existsSync(".env.local") ? ".env.local" : ".env",
);
dotenv.config({ path: envPath });

const isProduction = process.env.NODE_ENV === "production";

// Configuration dynamique
const dbConfig = isProduction
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "Admin123",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "reporting_batex-ci",
      ssl: false,
    };

const pool = new Pool({
  ...dbConfig,
  max: 15,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Test de connexion silencieux mais informatif
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log(
      `${colors.green}✅ DB CONNECTÉE : ${isProduction ? "SUPABASE (PROD)" : "POSTGRES (LOCAL)"}${colors.reset}`,
    );
  } catch (err) {
    console.error(`${colors.red}❌ ERREUR DB : ${err.message}${colors.reset}`);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: () => pool.end(),
};
