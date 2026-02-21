const express = require("express");
const router = express.Router();
const { userController } = require("../controllers");
const { authenticate, authorize } = require("../middleware/auth");
const { validatePagination } = require("../middleware/validation");

/**
 * ==========================================
 * USER ROUTES
 * Base: /api/users
 * ==========================================
 */

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination
 * @access  Private (Admin, DG)
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "DG"),
  validatePagination,
  userController.getAllUsers,
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin, DG)
 */
router.get(
  "/stats",
  authenticate,
  authorize("ADMIN", "DG"),
  userController.getUserStats,
);

/**
 * @route   GET /api/users/:id
 * @desc    Get single user
 * @access  Private (Admin, DG, Manager)
 */
router.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "DG", "MANAGER"),
  userController.getUser,
);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin)
 */
router.post("/", authenticate, authorize("ADMIN"), userController.createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin)
 */
router.put("/:id", authenticate, authorize("ADMIN"), userController.updateUser);

/**
 * @route   PUT /api/users/:id/activate
 * @desc    Activate user
 * @access  Private (Admin)
 */
router.put(
  "/:id/activate",
  authenticate,
  authorize("ADMIN"),
  userController.activateUser,
);

/**
 * @route   PUT /api/users/:id/deactivate
 * @desc    Deactivate user
 * @access  Private (Admin)
 */
router.put(
  "/:id/deactivate",
  authenticate,
  authorize("ADMIN"),
  userController.deactivateUser,
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  userController.deleteUser,
);

module.exports = router;
