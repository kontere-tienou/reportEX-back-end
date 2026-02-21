const express = require("express");
const router = express.Router();
const { authController } = require("../controllers");
const { authenticate, authorize } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const { validateBody, sanitizeBody } = require("../middleware/validation");

/**
 * ==========================================
 * AUTH ROUTES
 * Base: /api/auth
 * ==========================================
 */

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  "/login",
  authLimiter,
  validateBody,
  sanitizeBody,
  authController.login,
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticate, authController.getProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  "/change-password",
  authenticate,
  validateBody,
  sanitizeBody,
  authController.changePassword,
);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/register",
  authenticate,
  authorize("ADMIN"),
  validateBody,
  sanitizeBody,
  authController.register,
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", authenticate, authController.logout);

module.exports = router;
