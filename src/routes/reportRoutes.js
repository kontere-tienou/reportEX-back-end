const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authenticate, authorize } = require("../middleware/auth");

// 🔐 Toutes les routes protégées
router.use(authenticate);

// 🔥 IMPORTANT → pour /api/reports
router.get("/", authorize("DG", "ADMIN"), reportController.getAllReports);
router.get("/my-reports", reportController.getMyReports);
router.get("/:id", reportController.getReportDetails);
router.post("/", reportController.createReport);
router.put("/:id", reportController.updateReport);
router.delete("/:id", reportController.deleteReport);
router.post("/:id/submit", reportController.submitReport);
router.post("/:id/read", authenticate, reportController.markAsRead);
router.get("/:id/readers", authenticate, reportController.getReaders);
router.get("/:id/comments", authenticate, reportController.getComments);
router.post("/:id/comments", authenticate, reportController.addComment);
router.post("/:id/annotations", authenticate, reportController.addAnnotation);
router.get("/:id/export/pdf", authenticate, reportController.exportPdf);

// Validation (direction + admin seulement)
router.post(
  "/:id/validate",
  authorize("DG", "ADMIN"),
  reportController.validateReport,
);

/* ==============================
   📊 STATISTIQUES
============================== */

router.get(
  "/stats/:departmentId",
  authorize("DG", "ADMIN"),
  reportController.getDepartmentStats,
);


module.exports = router;
