const { Notification } = require("../models");
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * NOTIFICATION CONTROLLER
 * ==========================================
 */

const notificationController = {
  /**
   * Get user notifications
   * GET /api/notifications
   */
  async getNotifications(req, res) {
    try {
      const { page, limit, is_read, type } = req.query;

      const result = await Notification.findByUserId(req.userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        is_read:
          is_read === "true" ? true : is_read === "false" ? false : undefined,
        type,
      });

      return paginatedResponse(
        res,
        result.notifications,
        result.pagination,
        "Notifications récupérées",
      );
    } catch (error) {
      console.error("Get notifications error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des notifications",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get unread count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    try {
      const count = await Notification.getUnreadCount(req.userId);

      return successResponse(
        res,
        { unreadCount: count },
        "Nombre de notifications non lues",
      );
    } catch (error) {
      console.error("Get unread count error:", error);
      return errorResponse(
        res,
        "Erreur lors du comptage",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;

      const notification = await Notification.markAsRead(id);

      if (!notification) {
        return notFoundResponse(res, "Notification non trouvée");
      }

      return successResponse(
        res,
        { notification },
        "Notification marquée comme lue",
      );
    } catch (error) {
      console.error("Mark as read error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Mark all as read
   * PUT /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    try {
      const count = await Notification.markAllAsRead(req.userId);

      return successResponse(
        res,
        { count },
        `${count} notifications marquées comme lues`,
      );
    } catch (error) {
      console.error("Mark all as read error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;

      await Notification.delete(id);

      return successResponse(res, null, "Notification supprimée");
    } catch (error) {
      console.error("Delete notification error:", error);
      return errorResponse(
        res,
        "Erreur lors de la suppression",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get notification stats
   * GET /api/notifications/stats
   */
  async getStats(req, res) {
    try {
      const stats = await Notification.getStats(req.userId);

      return successResponse(res, { stats }, "Statistiques récupérées");
    } catch (error) {
      console.error("Get notification stats error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des statistiques",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = notificationController;
