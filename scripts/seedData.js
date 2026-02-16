#!/usr/bin/env node

const bcrypt = require("bcryptjs");
const db = require("../src/config/database");
const logger = require("../src/config/logger");

/**
 * Script pour peupler la base de données avec des données de test
 */

async function seedDatabase() {
  try {
    console.log("🌱 Démarrage du seeding de la base de données...\n");

    // Données des départements (déjà en DB via schema.sql)
    const departments = [
      { id: 1, name: "Comptabilité", code: "COMPTA" },
      { id: 2, name: "Bureau d'Étude & Développement", code: "BED" },
      { id: 3, name: "Maintenance", code: "MAINT" },
      { id: 4, name: "Filature", code: "FILAT" },
      { id: 5, name: "Impression", code: "IMPR" },
      { id: 6, name: "Stock", code: "STOCK" },
      { id: 7, name: "Achats", code: "ACHAT" },
      { id: 8, name: "Commercial", code: "COMM" },
      { id: 9, name: "Informatique", code: "IT" },
      { id: 10, name: "Ressources Humaines", code: "RH" },
      { id: 11, name: "Direction", code: "DIR" },
    ];

    // Créer un mot de passe hashé pour les utilisateurs de test
    const password = await bcrypt.hash("Test@123", 10);

    console.log("👥 Création des utilisateurs de test...");

    // Créer un responsable pour chaque département
    for (const dept of departments) {
      const username = `resp_${dept.code.toLowerCase()}`;
      const email = `${dept.code.toLowerCase()}@batex-ci.com`;
      const fullName = `Responsable ${dept.name}`;

      try {
        await db.query(
          `INSERT INTO users (username, email, password_hash, full_name, department_id, role)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO NOTHING`,
          [username, email, password, fullName, dept.id, "responsable"],
        );
        console.log(`  ✓ Créé: ${username} (${dept.name})`);
      } catch (error) {
        console.log(`  ⚠ Existe déjà: ${username}`);
      }
    }

    // Créer des validateurs
    console.log("\n👨‍💼 Création des validateurs...");

    const validators = [
      {
        username: "validateur1",
        email: "validateur1@batex-ci.com",
        fullName: "Validateur Principal",
        deptId: 11, 
      },
      {
        username: "validateur2",
        email: "validateur2@batex-ci.com",
        fullName: "Validateur Secondaire",
        deptId: 11, 
      },
    ];

    for (const val of validators) {
      try {
        await db.query(
          `INSERT INTO users (username, email, password_hash, full_name, department_id, role)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO NOTHING`,
          [
            val.username,
            val.email,
            password,
            val.fullName,
            val.deptId,
          ],
        );
        console.log(`  ✓ Créé: ${val.username}`);
      } catch (error) {
        console.log(`  ⚠ Existe déjà: ${val.username}`);
      }
    }

    // Créer quelques rapports de test pour le département Maintenance
    console.log("\n📊 Création de rapports de test (Maintenance)...");

    // Récupérer l'ID du template maintenance hebdomadaire
    const templateResult = await db.query(
      `SELECT id FROM report_templates 
       WHERE department_id = 3 AND frequency = 'hebdomadaire' 
       LIMIT 1`,
    );

    if (templateResult.rows.length > 0) {
      const templateId = templateResult.rows[0].id;

      // Récupérer l'ID du responsable maintenance
      const userResult = await db.query(
        `SELECT id FROM users WHERE username = 'resp_maint' LIMIT 1`,
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;

        // Créer 3 rapports de test
        const testReports = [
          {
            status: "valide",
            periodStart: "2026-01-27",
            periodEnd: "2026-02-02",
            data: {
              interventions_preventives: 15,
              interventions_correctives: 8,
              machines_arretees: 2,
              temps_arret_total: 3.5,
              pieces_commandees: 10,
              pieces_recues: 8,
              cout_maintenance: 180000,
              observations:
                "Semaine normale avec maintenance préventive programmée",
              principales_pannes: "Pompe hydraulique atelier A",
              besoins_urgents: "Pièces de rechange pour convoyeur B",
            },
          },
          {
            status: "soumis",
            periodStart: "2026-02-03",
            periodEnd: "2026-02-09",
            data: {
              interventions_preventives: 12,
              interventions_correctives: 5,
              machines_arretees: 1,
              temps_arret_total: 2,
              pieces_commandees: 7,
              pieces_recues: 7,
              cout_maintenance: 125000,
              observations: "Semaine calme, maintenance de routine",
              principales_pannes: "Aucune panne majeure",
              besoins_urgents: "RAS",
            },
          },
          {
            status: "brouillon",
            periodStart: "2026-02-10",
            periodEnd: "2026-02-16",
            data: {
              interventions_preventives: 10,
              interventions_correctives: 3,
              machines_arretees: 0,
              temps_arret_total: 0,
              pieces_commandees: 5,
              pieces_recues: 4,
              cout_maintenance: 95000,
              observations: "En cours...",
              principales_pannes: "",
              besoins_urgents: "",
            },
          },
        ];

        for (const report of testReports) {
          try {
            await db.query(
              `INSERT INTO reports 
               (template_id, user_id, department_id, period_start, period_end, data, status, submitted_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                templateId,
                userId,
                3, // Maintenance
                report.periodStart,
                report.periodEnd,
                JSON.stringify(report.data),
                report.status,
                report.status !== "brouillon" ? new Date() : null,
              ],
            );
            console.log(
              `  ✓ Créé: Rapport ${report.status} (${report.periodStart})`,
            );
          } catch (error) {
            console.log(`  ⚠ Erreur création rapport:`, error.message);
          }
        }
      }
    }

    console.log("\n✅ Seeding terminé avec succès!\n");
    console.log("📝 Utilisateurs créés:");
    console.log("   - admin / Admin@123 (déjà existant)");
    console.log("   - resp_[dept] / Test@123 (pour chaque département)");
    console.log("   - validateur1 / Test@123");
    console.log("   - validateur2 / Test@123");
    console.log(
      "\n🎯 Vous pouvez maintenant vous connecter avec ces comptes!\n",
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erreur lors du seeding:", error);
    logger.error("Seeding failed:", error);
    process.exit(1);
  }
}

// Exécuter le seeding
seedDatabase();
