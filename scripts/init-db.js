const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

// Couleurs pour les logs
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

// ============================================
// FONCTION DE LOG AVEC COULEURS
// ============================================
function log(color, emoji, message, data = null) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
  if (data) {
    console.log(`${colors.dim}  → ${data}${colors.reset}`);
  }
}

// ============================================
// EN-TÊTE
// ============================================
console.log(
  `\n${colors.magenta}═══════════════════════════════════════════${colors.reset}`,
);
console.log(
  `${colors.magenta}  🚀 BATEX - INITIALISATION BASE DE DONNÉES${colors.reset}`,
);
console.log(
  `${colors.magenta}═══════════════════════════════════════════${colors.reset}\n`,
);

// ============================================
// 1. CHARGEMENT DES VARIABLES D'ENVIRONNEMENT
// ============================================
log(colors.cyan, "📁", "Chargement des variables d'environnement...");

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  log(colors.green, "✅", "Fichier .env.local chargé");
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  log(colors.green, "✅", "Fichier .env chargé");
} else {
  log(
    colors.yellow,
    "⚠️",
    "Aucun fichier .env trouvé, utilisation des variables système",
  );
}

// ============================================
// 2. VÉRIFICATION DE DATABASE_URL
// ============================================
console.log(
  `\n${colors.cyan}🔍 Vérification de la configuration...${colors.reset}`,
);

if (!process.env.DATABASE_URL) {
  log(colors.red, "❌", "DATABASE_URL non définie !");
  console.log(
    `\n${colors.yellow}📋 Pour utiliser Railway PostgreSQL, définissez :${colors.reset}`,
  );
  console.log(
    `${colors.dim}   DATABASE_URL=postgresql://utilisateur:motdepasse@hôte:port/base${colors.reset}`,
  );
  console.log(`\n${colors.cyan}Exemple avec ta base Railway :${colors.reset}`);
  console.log(
    `${colors.green}   $env:DATABASE_URL="postgresql://postgres:prPOzGDsHemefQJFNFTCOSRuePYVfBvN@switchback.proxy.rlwy.net:57664/railway"${colors.reset}`,
  );
  process.exit(1);
}

// Afficher l'URL masquée
const maskedUrl = process.env.DATABASE_URL.replace(/:[^:]*@/, ":***@");
log(colors.green, "✅", "DATABASE_URL trouvée:", maskedUrl);

// ============================================
// 3. GÉNÉRATION DU MOT DE PASSE ADMIN
// ============================================
console.log(
  `\n${colors.cyan}🔐 Génération du mot de passe admin...${colors.reset}`,
);

async function generateAdminHash() {
  const adminPassword = "Admin123!";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(adminPassword, salt);
  log(colors.green, "✅", "Mot de passe admin généré");
  return { hash, plainPassword: adminPassword };
}

// ============================================
// 4. INITIALISATION DE LA BASE
// ============================================
async function initDatabase() {
  const pool = null;

  try {
    // Générer le hash admin
    const { hash: adminHash, plainPassword } = await generateAdminHash();

    // Connexion à la base
    console.log(
      `\n${colors.cyan}🔌 Connexion à la base de données...${colors.reset}`,
    );

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Nécessaire pour Railway
      },
      connectionTimeoutMillis: 10000,
    });

    // Test de connexion
    const testClient = await pool.connect();
    log(colors.green, "✅", "Connexion réussie à PostgreSQL");
    testClient.release();

    // Lecture du fichier SQL
    console.log(`\n${colors.cyan}📖 Lecture du script SQL...${colors.reset}`);

    const sqlPath = path.join(__dirname, "..", "src", "config", "init.sql");

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Fichier SQL introuvable: ${sqlPath}`);
    }

    let sql = fs.readFileSync(sqlPath, "utf8");
    log(colors.green, "✅", `Script SQL chargé (${sql.length} caractères)`);

    // Remplacer le placeholder du mot de passe admin
    sql = sql.replace(
      /\'\$2b\$10\$YourHashedPasswordHere\'/g,
      `'${adminHash}'`,
    );

    // Exécution du script
    console.log(`\n${colors.cyan}📦 Exécution du script SQL...${colors.reset}`);

    await pool.query(sql);
    log(colors.green, "✅", "Script SQL exécuté avec succès");

    // ============================================
    // 5. VÉRIFICATIONS
    // ============================================
    console.log(
      `\n${colors.magenta}═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.magenta}  📊 VÉRIFICATION DES DONNÉES${colors.reset}`,
    );
    console.log(
      `${colors.magenta}═══════════════════════════════════════════${colors.reset}`,
    );

    // Vérifier les rôles
    const roles = await pool.query(
      "SELECT COUNT(*) as count, array_agg(code) as codes FROM roles",
    );
    console.log(
      `${colors.cyan}  • Rôles:${colors.reset} ${roles.rows[0].count}`,
    );
    if (roles.rows[0].codes) {
      console.log(
        `${colors.dim}    → ${roles.rows[0].codes.join(", ")}${colors.reset}`,
      );
    }

    // Vérifier les départements
    const depts = await pool.query("SELECT COUNT(*) as count FROM departments");
    console.log(
      `${colors.cyan}  • Départements:${colors.reset} ${depts.rows[0].count}`,
    );

    // Vérifier les utilisateurs
    const users = await pool.query(`
      SELECT COUNT(*) as count, 
             array_agg(email) as emails,
             array_agg(role) as roles
      FROM users
    `);
    console.log(
      `${colors.cyan}  • Utilisateurs:${colors.reset} ${users.rows[0].count}`,
    );

    // Afficher les infos admin
    const admin = await pool.query(`
      SELECT id, email, full_name, role, 
             to_char(created_at, 'DD/MM/YYYY HH24:MI') as created_at
      FROM users 
      WHERE role = 'ADMIN' 
      LIMIT 1
    `);

    if (admin.rows.length > 0) {
      console.log(
        `\n${colors.green}✅ Utilisateur ADMIN créé :${colors.reset}`,
      );
      console.log(`${colors.cyan}  • ID:${colors.reset} ${admin.rows[0].id}`);
      console.log(
        `${colors.cyan}  • Email:${colors.reset} ${admin.rows[0].email}`,
      );
      console.log(
        `${colors.cyan}  • Nom:${colors.reset} ${admin.rows[0].full_name}`,
      );
      console.log(
        `${colors.cyan}  • Rôle:${colors.reset} ${admin.rows[0].role}`,
      );
      console.log(
        `${colors.cyan}  • Créé le:${colors.reset} ${admin.rows[0].created_at}`,
      );
      console.log(
        `\n${colors.yellow}🔐 Identifiants de connexion :${colors.reset}`,
      );
      console.log(
        `  • Email: ${colors.bright}${admin.rows[0].email}${colors.reset}`,
      );
      console.log(
        `  • Mot de passe: ${colors.bright}${plainPassword}${colors.reset} (à changer à la première connexion)`,
      );
    }

    // Vérifier les contraintes et index
    const indexes = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('users', 'departments', 'roles')
      ORDER BY tablename, indexname
    `);

    console.log(`\n${colors.cyan}📊 Index créés :${colors.reset}`);
    indexes.rows.forEach((idx) => {
      console.log(
        `${colors.dim}  • ${idx.tablename}: ${idx.indexname}${colors.reset}`,
      );
    });

    // ============================================
    // 6. RÉSUMÉ FINAL
    // ============================================
    console.log(
      `\n${colors.green}═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.green}  ✅ INITIALISATION TERMINÉE AVEC SUCCÈS${colors.reset}`,
    );
    console.log(
      `${colors.green}═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`\n${colors.cyan}📈 Résumé :${colors.reset}`);
    console.log(`  • ${roles.rows[0].count} rôles créés`);
    console.log(`  • ${depts.rows[0].count} départements créés`);
    console.log(`  • ${users.rows[0].count} utilisateur(s) créé(s)`);
    console.log(`  • ${indexes.rows.length} index créés`);
  } catch (error) {
    console.log(
      `\n${colors.red}═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.red}  ❌ ERREUR D'INITIALISATION${colors.reset}`);
    console.log(
      `${colors.red}═══════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.red}📌 Type:${colors.reset} ${error.name || "Erreur"}`,
    );
    console.log(`${colors.red}📌 Message:${colors.reset} ${error.message}`);

    if (error.code) {
      console.log(`${colors.red}📌 Code SQL:${colors.reset} ${error.code}`);
    }

    if (error.position) {
      try {
        const sqlPath = path.join(__dirname, "..", "src", "config", "init.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");
        const lines = sql.split("\n");
        let charCount = 0;

        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount >= error.position) {
            console.log(
              `\n${colors.yellow}📍 Erreur à la ligne ${i + 1}:${colors.reset}`,
            );
            console.log(`   ${colors.red}${lines[i].trim()}${colors.reset}`);

            // Afficher le contexte
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length - 1, i + 2);

            console.log(`\n${colors.cyan}Contexte :${colors.reset}`);
            for (let j = start; j <= end; j++) {
              const prefix = j === i ? "➡️ " : "  ";
              const lineNum = (j + 1).toString().padStart(3, " ");
              console.log(`   ${prefix}${lineNum}: ${lines[j]}`);
            }
            break;
          }
        }
      } catch (e) {
        // Ignorer les erreurs de lecture
      }
    }

    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      console.log(`\n${colors.dim}🔌 Connexion fermée${colors.reset}`);
    }
  }
}

// ============================================
// EXÉCUTION
// ============================================
initDatabase().catch((error) => {
  console.error(`${colors.red}❌ Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
