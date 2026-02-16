// /routes/managementRoutes.js

const express = require("express");
const router = express.Router();
const managementController = require("../controllers/managementController");
const { authMiddleware, authorizeRoles } = require("../middleware/auth");

// Auth middleware to ensure the user is logged in
router.use(authMiddleware);

// Routes for Direction (Management)
router.get("/overview", managementController.getConsolidatedView);
router.get("/departments", managementController.getAllDepartments);
router.get("/objectives", managementController.getObjectives); 
router.post(
  "/objectives",
  authorizeRoles("admin"),
  managementController.createObjective,
); // Create a new objective (only for admins)
router.put(
  "/reports/:id/validate",
  authorizeRoles("admin", "validateur"),
  managementController.validateReport,
); // Validate report (admin/validateur)

module.exports = router;
