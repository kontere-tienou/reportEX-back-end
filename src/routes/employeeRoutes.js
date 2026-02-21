const express = require("express");
const router = express.Router();
const { employeeController } = require("../controllers");
const { authenticate, authorize } = require("../middleware/auth");
const { validatePagination } = require("../middleware/validation");

/**
 * ==========================================
 * EMPLOYEE ROUTES
 * Base: /api/employees
 * ==========================================
 */

/**
 * @route   GET /api/employees
 * @desc    Get all employees with pagination
 * @access  Private (RH, Admin, DG)
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "DG", "MANAGER"),
  validatePagination,
  employeeController.getAllEmployees,
);

/**
 * @route   GET /api/employees/search
 * @desc    Search employees
 * @access  Private
 */
router.get("/search", authenticate, employeeController.searchEmployees);

/**
 * @route   GET /api/employees/stats
 * @desc    Get employee statistics
 * @access  Private (RH, Admin, DG)
 */
router.get(
  "/stats",
  authenticate,
  authorize("ADMIN", "DG", "MANAGER"),
  employeeController.getEmployeeStats,
);

/**
 * @route   GET /api/employees/:id
 * @desc    Get single employee
 * @access  Private
 */
router.get("/:id", authenticate, employeeController.getEmployee);

/**
 * @route   POST /api/employees
 * @desc    Create new employee
 * @access  Private (RH, Admin)
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  employeeController.createEmployee,
);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee
 * @access  Private (RH, Admin)
 */
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  employeeController.updateEmployee,
);

/**
 * @route   PUT /api/employees/:id/terminate
 * @desc    Terminate employee
 * @access  Private (RH, Admin)
 */
router.put(
  "/:id/terminate",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  employeeController.terminateEmployee,
);

module.exports = router;
