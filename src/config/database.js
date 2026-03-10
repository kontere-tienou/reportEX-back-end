/*const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: "postgres",
  password: "admin",
  host: "localhost",
  port: 5432,
  database: "reporting_batex-ci",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de connexion
pool.on("connect", () => {
  console.log("✅ Connecté à la base de données PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Erreur inattendue sur la connexion DB:", err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
*/

const { Pool } = require('pg');
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
};