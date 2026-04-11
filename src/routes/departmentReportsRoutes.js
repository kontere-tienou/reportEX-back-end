// routes/departmentReportRoutes.js 
const express = require("express");
const router = express.Router({ mergeParams: true });
const reportController = require("../controllers/reportController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// Routes avec départementCode
router.get("/", reportController.getReportsByDepartment);
router.post("/", reportController.createReportForDepartment);
router.get("/stats", reportController.getDepartmentStatsByCode);

// Routes pour rapport spécifique
router.get("/:reportId", reportController.getReportDetailsByDepartment);
router.patch("/:reportId", reportController.updateReportByDepartment);
router.delete("/:reportId", reportController.deleteReportByDepartment);
router.post("/:reportId/submit", reportController.submitReportByDepartment);
router.post(
  "/:reportId/validate",
  authorize("DG"),
  reportController.validateReportByDepartment,
);
router.post("/:reportId/read", reportController.markAsReadByDepartment);
router.get("/:reportId/readers", reportController.getReadersByDepartment);
router.get("/:reportId/comments", reportController.getCommentsByDepartment);
router.post("/:reportId/comments", reportController.addCommentByDepartment);
//router.delete("/comments/:commentId", reportController.deleteComment);
router.post(
  "/:reportId/annotations",
  reportController.addAnnotationByDepartment,
);
router.get("/:reportId/export/pdf", reportController.exportPdfByDepartment);

module.exports = router;
