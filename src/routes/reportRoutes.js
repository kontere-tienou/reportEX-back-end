const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authMiddleware, authorizeRoles } = require("../middleware/auth");

// 🔐 Toutes les routes protégées
router.use(authMiddleware);

/*RAPPORTS*/

// 🔥 IMPORTANT → pour /api/reports
router.get(
  "/",
  authorizeRoles("direction", "admin"),
  reportController.getAllReports,
);

router.get("/my-reports", reportController.getMyReports);

router.get("/:id", reportController.getReportDetails);

router.post("/", reportController.createReport);

router.put("/:id", reportController.updateReport);

router.delete("/:id", reportController.deleteReport);

router.post("/:id/submit", reportController.submitReport);

// Validation (direction + admin seulement)
router.post(
  "/:id/validate",
  authorizeRoles("direction", "admin"),
  reportController.validateReport,
);

/* ==============================
   📊 STATISTIQUES
============================== */

router.get(
  "/stats/:departmentId",
  authorizeRoles("direction", "admin"),
  reportController.getDepartmentStats,
);


module.exports = router;
