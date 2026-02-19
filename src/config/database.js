const { Pool } = require('pg');
const {user} = require("pg/lib/native");
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    password: 'admin',
    host: 'localhost',
    port: 5432,
    database: 'reporting_batex-ci',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test de connexion
pool.on('connect', () => {
    console.log('✅ Connecté à la base de données PostgreSQL');
    console.log(user)
});

pool.on('error', (err) => {
    console.error('Erreur inattendue sur la connexion DB:', err);
    process.exit(-1);
});


module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};