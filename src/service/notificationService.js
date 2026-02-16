const db = require("../config/database");
const logger = require("../config/logger");
const { NOTIFICATION_TYPES } = require("../config/constants");

const notificationService = {
  /**
   * Créer une notification pour un utilisateur
   */
  async createNotification(userId, type, title, message, link = null) {
    try {
      const result = await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, type, title, message, link],
      );

      logger.info(`Notification created for user ${userId}: ${title}`);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  },

  /**
   * Créer des notifications en masse
   */
  async createBulkNotifications(userIds, type, title, message, link = null) {
    if (!userIds || userIds.length === 0) {
      logger.warn("No users to notify");
      return [];
    }

    try {
      const values = userIds
        .map(
          (userId, index) =>
            `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5})`,
        )
        .join(",");

      const params = userIds.flatMap((userId) => [
        userId,
        type,
        title,
        message,
        link,
      ]);

      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ${values}`,
        params,
      );

      logger.info(`Bulk notifications created for ${userIds.length} users`);
      return userIds.length;
    } catch (error) {
      logger.error("Error creating bulk notifications:", error);
      throw error;
    }
  },

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await db.query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId],
      );

      if (result.rows.length === 0) {
        throw new Error("Notification non trouvée");
      }

      return result.rows[0];
    } catch (error) {
      logger.error("Error marking notification as read:", error);
      throw error;
    }
  },

  /**
   * Marquer toutes les notifications comme lues
   */
  async markAllAsRead(userId) {
    try {
      const result = await db.query(
        `UPDATE notifications 
         SET is_read = true 
         WHERE user_id = $1 AND is_read = false
         RETURNING id`,
        [userId],
      );

      logger.info(
        `Marked ${result.rowCount} notifications as read for user ${userId}`,
      );
      return result.rowCount;
    } catch (error) {
      logger.error("Error marking all notifications as read:", error);
      throw error;
    }
  },

  /**
   * Obtenir le nombre de notifications non lues
   */
  async getUnreadCount(userId) {
    try {
      const result = await db.query(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false",
        [userId],
      );
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error("Error getting unread count:", error);
      return 0;
    }
  },

  /**
   * Obtenir les notifications d'un utilisateur
   */
  async getUserNotifications(
    userId,
    limit = 20,
    offset = 0,
    unreadOnly = false,
  ) {
    try {
      let query = `
        SELECT id, type, title, message, link, is_read, created_at
        FROM notifications
        WHERE user_id = $1
      `;

      const params = [userId];

      if (unreadOnly) {
        query += ` AND is_read = false`;
      }

      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error("Error getting user notifications:", error);
      throw error;
    }
  },

  /**
   * Nettoyer les anciennes notifications lues
   */
  async cleanupOldNotifications(daysOld = 90) {
    try {
      const result = await db.query(
        `DELETE FROM notifications 
         WHERE created_at < NOW() - INTERVAL '${daysOld} days'
         AND is_read = true
         RETURNING id`,
      );

      logger.info(`Cleaned up ${result.rowCount} old notifications`);
      return result.rowCount;
    } catch (error) {
      logger.error("Error cleaning up notifications:", error);
      throw error;
    }
  },

  /**
   * Notifier les validateurs d'un nouveau rapport
   */
  async notifyValidators(reportId, reportData) {
    try {
      // Récupérer les validateurs actifs
      const validators = await db.query(
        `SELECT id, email, full_name 
         FROM users 
         WHERE role IN ('validateur', 'admin') 
         AND is_active = true`,
      );

      if (validators.rows.length === 0) {
        logger.warn("No validators to notify");
        return 0;
      }

      const validatorIds = validators.rows.map((v) => v.id);

      await this.createBulkNotifications(
        validatorIds,
        NOTIFICATION_TYPES.VALIDATION,
        "Nouveau rapport à valider",
        `Un rapport ${reportData.template_name} a été soumis par ${reportData.author_name}`,
        `/reports/${reportId}`,
      );

      return validators.rows.length;
    } catch (error) {
      logger.error("Error notifying validators:", error);
      throw error;
    }
  },

  /**
   * Notifier l'auteur de la validation/rejet
   */
  async notifyAuthor(userId, reportId, status, validatorName, comments = null) {
    const title =
      status === "valide" ? "✓ Report Validated" : "✗ Report Rejected";

    const message =
      status === "valide"
        ? `Your report has been validated by ${validatorName}`
        : `Your report has been rejected by ${validatorName} ${comments ? ": " + comments : ""}`;

    await db.query(
      "INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5)",
      [userId, "validation", title, message, `/reports/${reportId}`],
    );

    if (status === "valide") {
      await sendReportValidatedEmail(userId, validatorName, {
        reportId,
        status,
      });
    } else {
      await sendReportRejectedEmail(
        userId,
        validatorName,
        { reportId, status },
        comments,
      );
    }

    return true;
  },

  /**
   * Notifier pour les rappels de rapports
   */
  async notifyReminder(userId, departmentName, frequency) {
    try {
      const frequencyText =
        frequency === "hebdomadaire" ? "hebdomadaire" : "mensuel";

      await this.createNotification(
        userId,
        NOTIFICATION_TYPES.REMINDER,
        `📅 Rappel: Rapport ${frequencyText}`,
        `N'oubliez pas de soumettre votre rapport ${frequencyText} pour ${departmentName}`,
        "/reports/new",
      );

      return true;
    } catch (error) {
      logger.error("Error notifying reminder:", error);
      throw error;
    }
  },
};

module.exports = notificationService;
