// src/config/database.js
const { Pool } = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

// Load .env.local if exists
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

// === LOCAL DEVELOPMENT ONLY ===
const dbConfig = {
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "Admin123",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "reporting_batex-ci",
  ssl: false,
  max: 10,
  connectionTimeoutMillis: 10000,
};

console.log(
  `${colors.cyan}💻 LOCAL MODE - Connecting to PostgreSQL${colors.reset}`,
);
console.log(
  `${colors.cyan}📊 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}${colors.reset}`,
);

// Create pool
const pool = new Pool(dbConfig);

// Test connection
(async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log(
      `${colors.green}✅ LOCAL DB Connected successfully${colors.reset}`,
    );
  } catch (err) {
    console.log(
      `${colors.red}❌ LOCAL DB Connection Failed: ${err.message}${colors.reset}`,
    );
    console.log("Make sure PostgreSQL is running and credentials are correct.");
  }
})();

pool.on("error", (err) => {
  console.log(
    `${colors.red}❌ Database Pool Error: ${err.message}${colors.reset}`,
  );
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  closePool: async () => {
    await pool.end();
    console.log("🔄 Database pool closed");
  },
};
