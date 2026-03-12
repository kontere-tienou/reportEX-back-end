/*const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME || 'reporting_batex-ci',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test de connexion
pool.on('connect', () => {
    console.log('✅ Connecté à la base de données PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Erreur inattendue sur la connexion DB:', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};*/

const { Pool } = require("pg");
require("dotenv").config();

console.log("🔧 DB Configuration:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  ssl: "disabled for testing",
});

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "admin",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || "reporting_batex-ci",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Try WITHOUT SSL first
  ssl: false,
});

// Test de connexion
pool.on("connect", () => {
  console.log("✅ Connecté à la base de données PostgreSQL");
});

pool.on("error", (err) => {
  console.error("❌ Erreur sur la connexion DB:", err);
});

// Test initial
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Test de connexion réussi sans SSL");
    const res = await client.query("SELECT NOW() as current_time");
    console.log("🕒 Heure du serveur:", res.rows[0].current_time);
    client.release();
  } catch (err) {
    console.error("❌ Échec du test:", err.message);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};