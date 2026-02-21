const express = require("express");
const router = express.Router();
const { notificationController } = require("../controllers");
const { authenticate } = require("../middleware/auth");
const { validatePagination } = require("../middleware/validation");

/**
 * ==========================================
 * NOTIFICATION ROUTES
 * Base: /api/notifications
 * ==========================================
 */

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with pagination
 * @access  Private
 */
router.get(
  "/",
  authenticate,
  validatePagination,
  notificationController.getNotifications,
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private
 */
router.get(
  "/unread-count",
  authenticate,
  notificationController.getUnreadCount,
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get("/stats", authenticate, notificationController.getStats);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put("/:id/read", authenticate, notificationController.markAsRead);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/read-all", authenticate, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete("/:id", authenticate, notificationController.deleteNotification);

module.exports = router;
