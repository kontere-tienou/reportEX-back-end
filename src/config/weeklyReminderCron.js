const cron = require("node-cron");
const db = require("./database");
const emailService = require("../src/services/emailService");
const notificationService = require("../src/services/notificationService");
const logger = require("./logger");

/**
 * Cron job pour envoyer des rappels hebdomadaires
 * Exécuté tous les vendredis à 9h (heure de Bamako)
 */

const weeklyReminderJob = cron.schedule(
  "0 9 * * 5",
  async () => {
    try {
      logger.info("⏰ Starting weekly reminder job...");

      // Récupérer les utilisateurs qui n'ont pas soumis de rapport cette semaine
      const result = await db.query(`
      SELECT 
        u.id, 
        u.email, 
        u.full_name, 
        d.name as department_name
      FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'responsable'
        AND u.is_active = true
        AND NOT EXISTS (
          SELECT 1 
          FROM reports r
          JOIN report_templates rt ON r.template_id = rt.id
          WHERE r.user_id = u.id
            AND rt.frequency = 'hebdomadaire'
            AND r.created_at >= DATE_TRUNC('week', NOW())
            AND r.status IN ('soumis', 'valide')
        )
    `);

      const users = result.rows;

      if (users.length === 0) {
        logger.info(
          "✅ No users need weekly reminders - all reports submitted!",
        );
        return;
      }

      logger.info(`📧 Sending weekly reminders to ${users.length} users...`);

      // Envoyer les emails
      const emailResults = await emailService.sendBulkReminders(
        users,
        "hebdomadaire",
      );

      // Créer des notifications in-app
      for (const user of users) {
        await notificationService.notifyReminder(
          user.id,
          user.department_name,
          "hebdomadaire",
        );
      }

      // Logger les résultats
      const successCount = emailResults.filter((r) => r.success).length;
      const failureCount = emailResults.filter((r) => !r.success).length;

      logger.info(`📊 Weekly reminder job completed:`);
      logger.info(`   - Total users: ${users.length}`);
      logger.info(`   - Emails sent: ${successCount}`);
      logger.info(`   - Failures: ${failureCount}`);

      if (failureCount > 0) {
        logger.warn(`⚠️ ${failureCount} emails failed to send`);
      }
    } catch (error) {
      logger.error("❌ Weekly reminder job failed:", error);
    }
  },
  {
    timezone: "Africa/Bamako",
    scheduled: false, // Ne démarre pas automatiquement
  },
);

/**
 * Démarrer le cron job
 */
function startWeeklyReminderJob() {
  weeklyReminderJob.start();
  logger.info("✅ Weekly reminder cron job started (Fridays at 9:00 AM)");
}

/**
 * Arrêter le cron job
 */
function stopWeeklyReminderJob() {
  weeklyReminderJob.stop();
  logger.info("⏹️ Weekly reminder cron job stopped");
}

/**
 * Exécuter manuellement (pour tests)
 */
async function runWeeklyReminderNow() {
  logger.info("🚀 Running weekly reminder job manually...");

  try {
    // Récupérer les utilisateurs
    const result = await db.query(`
      SELECT 
        u.id, 
        u.email, 
        u.full_name, 
        d.name as department_name
      FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'responsable'
        AND u.is_active = true
      LIMIT 5
    `);

    const users = result.rows;

    if (users.length === 0) {
      logger.info("No users found for testing");
      return;
    }

    logger.info(`Sending test reminders to ${users.length} users...`);

    // Envoyer les rappels
    const emailResults = await emailService.sendBulkReminders(
      users,
      "hebdomadaire",
    );

    // Créer notifications
    for (const user of users) {
      await notificationService.notifyReminder(
        user.id,
        user.department_name,
        "hebdomadaire",
      );
    }

    logger.info("✅ Manual weekly reminder completed!");
  } catch (error) {
    logger.error("❌ Manual weekly reminder failed:", error);
  }
}

module.exports = {
  weeklyReminderJob,
  startWeeklyReminderJob,
  stopWeeklyReminderJob,
  runWeeklyReminderNow,
};
