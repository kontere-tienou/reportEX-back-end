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

router.get("/", authenticate, departmentController.getAllDepartments);
router.get("/:id", authenticate, departmentController.getDepartment);
router.get("/:id/users", authenticate, departmentController.getDepartmentUsers);
router.get("/:id/stats", authenticate, departmentController.getDepartmentStats);
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  departmentController.createDepartment,
);
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  departmentController.updateDepartment,
);
router.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  departmentController.deleteDepartment,
);

module.exports = router;
