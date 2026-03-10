const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// Routes statiques d'abord
router.get("/builder", reportController.initializeBuilder);
router.get("/my-reports", reportController.getMyReports);
router.get(
  "/stats/:departmentId",
  reportController.getDepartmentStats,
);

// Liste
router.get("/", reportController.getAllReports);

// Création
router.post("/", reportController.createReport);
router.post("/custom/generate", reportController.saveTemplate);
router.post("/generate", reportController.generateReport);

// Détail dynamique à la fin
router.get("/:id", reportController.getReportDetails);
router.put("/:id", reportController.updateReport);
router.delete("/:id", reportController.deleteReport);
router.post("/:id/submit", reportController.submitReport);
router.post("/:id/read", reportController.markAsRead);
router.get("/:id/readers", reportController.getReaders);
router.get("/:id/comments", reportController.getComments);
router.post("/:id/comments", reportController.addComment);
router.post("/:id/annotations", reportController.addAnnotation);
router.get("/:id/export/pdf", reportController.generateReport);
router.post("/:id/validate", authorize("DG"), reportController.validateReport);

module.exports = router;
