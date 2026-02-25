#!/usr/bin/env node

/**
 * ==========================================
 * TEST LOGIN
 * Script pour tester la connexion
 * ==========================================
 */

const axios = require("axios");

const API_URL = process.env.API_URL || "http://localhost:5008";

const testLogin = async (email, password) => {
  console.log("=".repeat(60));
  console.log("🧪 TEST DE CONNEXION");
  console.log("=".repeat(60));
  console.log("API URL:", API_URL);
  console.log("Email:", email);
  console.log("Password:", "***");
  console.log("");

  try {
    console.log("📤 Envoi de la requête...\n");

    const response = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email,
        password,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        validateStatus: () => true, // Ne pas throw sur erreur HTTP
      },
    );

    console.log("📥 Réponse reçue:");
    console.log("-".repeat(60));
    console.log("Status:", response.status, response.statusText);
    console.log("Headers:", JSON.stringify(response.headers, null, 2));
    console.log("");

    if (response.status === 200) {
      console.log("✅ CONNEXION RÉUSSIE!\n");
      console.log("User:", JSON.stringify(response.data.data.user, null, 2));
      console.log("");
      console.log(
        "Access Token:",
        response.data.data.tokens.accessToken.substring(0, 50) + "...",
      );
      console.log("");
    } else {
      console.log("❌ CONNEXION ÉCHOUÉE!\n");
      console.log("Erreur:", JSON.stringify(response.data, null, 2));
      console.log("");
    }
  } catch (error) {
    console.error("❌ ERREUR:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }

  console.log("=".repeat(60));
};

// Arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("Usage: node testLogin.js <email> <password>");
  console.log("Example: node testLogin.js admin@batex-ci.com Admin@123");
  process.exit(1);
}

const [email, password] = args;

testLogin(email, password)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
