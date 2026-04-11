// routes/reportAccessRequestRoutes.js
const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const reportAccessController = require("../controllers/reportAccessRequestController");

// 🔐 Toutes les routes nécessitent une authentification
router.use(authenticate);

// Routes accessibles à tous les utilisateurs authentifiés
router.post("/report/:reportId/request", reportAccessController.requestAccess);
router.get("/my-requests", reportAccessController.getMyRequests);
router.delete("/:id", reportAccessController.cancelRequest);
router.get("/report/:reportId/check", reportAccessController.checkAccess);


router.get(
  "/report/:reportId/requests",
  reportAccessController.getRequestsByReport,
);

// Routes réservées à la direction
router.get(
  "/pending",
  authorize("DG", "ADMIN"),
  reportAccessController.getPendingRequests,
);
router.post(
  "/:id/approve",
  authorize("DG", "ADMIN"),
  reportAccessController.approveAccess,
);
router.post(
  "/:id/reject",
  authorize("DG", "ADMIN"),
  reportAccessController.rejectAccess,
);

module.exports = router;
