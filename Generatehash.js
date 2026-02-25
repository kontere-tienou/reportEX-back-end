#!/usr/bin/env node

/**
 * ==========================================
 * GENERATE PASSWORD HASH
 * Script pour générer un hash bcrypt
 * ==========================================
 
*/

const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("=".repeat(50));
console.log("GÉNÉRATEUR DE HASH BCRYPT");
console.log("=".repeat(50));
console.log("");

rl.question("Entrez le mot de passe à hasher: ", async (password) => {
  if (!password) {
    console.log("❌ Mot de passe vide!");
    rl.close();
    return;
  }

  console.log("\nGénération du hash...\n");

  try {
    // Générer le salt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    console.log("Salt généré:", salt);

    // Générer le hash
    const hash = await bcrypt.hash(password, salt);
    console.log("\n✅ Hash généré avec succès!\n");
    console.log("-".repeat(50));
    console.log("Hash:", hash);
    console.log("-".repeat(50));

    // Vérifier immédiatement
    const isValid = await bcrypt.compare(password, hash);
    console.log("\n🔍 Vérification:", isValid ? "✅ VALIDE" : "❌ INVALIDE");

    // SQL pour insérer
    console.log("\n📋 SQL INSERT:");
    console.log("-".repeat(50));
    console.log(
      `INSERT INTO users (email, password, full_name, role, is_active) VALUES`,
    );
    console.log(
      `  ('user@batex-ci.com', '${hash}', 'Nom Utilisateur', 'USER', true);`,
    );
    console.log("-".repeat(50));

    // SQL pour update
    console.log("\n📋 SQL UPDATE:");
    console.log("-".repeat(50));
    console.log(
      `UPDATE users SET password = '${hash}' WHERE email = 'user@batex-ci.com';`,
    );
    console.log("-".repeat(50));
  } catch (error) {
    console.error("\n❌ Erreur:", error.message);
  }

  rl.close();
});

rl.on("close", () => {
  console.log("\n👋 Au revoir!\n");
  process.exit(0);
});

