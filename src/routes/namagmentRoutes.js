// /routes/managementRoutes.js

const express = require("express");
const router = express.Router();
const managementController = require("../controllers/managementController");

const { authenticate, authorize } = require("../middleware/auth");

// 🔐 Toutes les routes protégées
router.use(authenticate);

// Routes for Direction (Management)
router.get("/overview", managementController.getConsolidatedView);
router.get("/departments", managementController.getAllDepartments);
router.get("/objectives", managementController.getObjectives); 
router.post(
  "/objectives",
  authorize("ADMIN"),
  managementController.createObjective,
); // Create a new objective (only for admins)
router.put(
  "/reports/:id/validate",
  authorize("ADMIN", "DG"),
  managementController.validateReport,
); // Validate report (admin/validateur)

module.exports = router;
