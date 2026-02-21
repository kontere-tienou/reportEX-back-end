const express = require("express");
const router = express.Router();
const { departmentController } = require("../controllers");
const { authenticate, authorize } = require("../middleware/auth");

/**
 * ==========================================
 * DEPARTMENT ROUTES
 * Base: /api/departments
 * ==========================================
 */

/**
 * @route   GET /api/departments
 * @desc    Get all departments
 * @access  Private
 */
router.get("/", authenticate, departmentController.getAllDepartments);

/**
 * @route   GET /api/departments/:id
 * @desc    Get single department
 * @access  Private
 */
router.get("/:id", authenticate, departmentController.getDepartment);

/**
 * @route   GET /api/departments/:id/stats
 * @desc    Get department statistics
 * @access  Private
 */
router.get("/:id/stats", authenticate, departmentController.getDepartmentStats);

/**
 * @route   POST /api/departments
 * @desc    Create new department
 * @access  Private (Admin)
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  departmentController.createDepartment,
);

/**
 * @route   PUT /api/departments/:id
 * @desc    Update department
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  departmentController.updateDepartment,
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete department (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  departmentController.deleteDepartment,
);

module.exports = router;
