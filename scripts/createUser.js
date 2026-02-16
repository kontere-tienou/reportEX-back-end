#!/usr/bin/env node

const bcrypt = require("bcryptjs");
const db = require("../src/config/database");
const logger = require("../src/config/logger");

/**
 * Script CLI pour créer des utilisateurs
 * Usage: node scripts/createUser.js --username=jdoe --email=jdoe@batex.com --name="John Doe" --department=3 [--password=pass] [--role=responsable]
 */

async function createUser() {
  try {
    const args = process.argv.slice(2);

    // Parser les arguments
    const getArg = (name) => {
      const arg = args.find((arg) => arg.startsWith(`--${name}=`));
      return arg ? arg.split("=")[1] : null;
    };

    const username = getArg("username");
    const email = getArg("email");
    const password = getArg("password") || "Test@123";
    const fullName = getArg("name");
    const departmentId = getArg("department");
    const role = getArg("role") || "responsable";

    // Validation
    if (!username || !email || !fullName || !departmentId) {
      console.error(`
❌ Arguments manquants!

Arguments requis:
  --username    Nom d'utilisateur (unique)
  --email       Email (unique)
  --name        Nom complet
  --department  ID du département (1-11)

Arguments optionnels:
  --password    Mot de passe (défaut: Test@123)
  --role        Rôle (défaut: responsable)
                Options: admin, validateur, responsable

Départements:
  1  = Comptabilité
  2  = Bureau d'Étude & Développement
  3  = Maintenance
  4  = Filature
  5  = Impression
  6  = Stock
  7  = Achats
  8  = Commercial
  9  = Informatique
  10 = Ressources Humaines
  11 = Direction

Exemple:
  node scripts/createUser.js --username=jdoe --email=jdoe@batex.com --name="John Doe" --department=3 --role=responsable
      `);
      process.exit(1);
    }

    // Valider le département
    const deptId = parseInt(departmentId);
    if (isNaN(deptId) || deptId < 1 || deptId > 11) {
      console.error("❌ ID département invalide (doit être entre 1 et 11)");
      process.exit(1);
    }

    // Valider le rôle
    const validRoles = ["admin", "validateur", "responsable"];
    if (!validRoles.includes(role)) {
      console.error(`❌ Rôle invalide. Options: ${validRoles.join(", ")}`);
      process.exit(1);
    }

    // Valider l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("❌ Format email invalide");
      process.exit(1);
    }

    console.log("\n👤 Création de l'utilisateur...\n");

    // Vérifier que le département existe
    const deptResult = await db.query(
      "SELECT name FROM departments WHERE id = $1",
      [deptId],
    );

    if (deptResult.rows.length === 0) {
      console.error("❌ Département non trouvé");
      process.exit(1);
    }

    const departmentName = deptResult.rows[0].name;

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name, department_id, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, fullName, deptId, role],
    );

    const user = result.rows[0];

    console.log("✅ Utilisateur créé avec succès!\n");
    console.log("📋 Détails:");
    console.log(`   ID:          ${user.id}`);
    console.log(`   Username:    ${user.username}`);
    console.log(`   Email:       ${user.email}`);
    console.log(`   Nom:         ${user.full_name}`);
    console.log(`   Département: ${departmentName} (ID: ${deptId})`);
    console.log(`   Rôle:        ${user.role}`);
    console.log(`   Mot de passe: ${password}`);
    console.log(
      "\n💡 L'utilisateur peut maintenant se connecter au système!\n",
    );

    logger.info(`User created: ${username} (${email})`);

    process.exit(0);
  } catch (error) {
    if (error.code === "23505") {
      // Violation de contrainte unique
      if (error.constraint === "users_username_key") {
        console.error("\n❌ Erreur: Ce nom d'utilisateur existe déjà\n");
      } else if (error.constraint === "users_email_key") {
        console.error("\n❌ Erreur: Cet email existe déjà\n");
      } else {
        console.error("\n❌ Erreur: Données en conflit\n");
      }
    } else {
      console.error("\n❌ Erreur:", error.message, "\n");
      logger.error("User creation failed:", error);
    }
    process.exit(1);
  }
}

// Exécuter
createUser();
