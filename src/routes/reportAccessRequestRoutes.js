const express = require("express");
const router = express.Router();

const { authenticate, authorize } = require("../middleware/auth");
const controller = require("../controllers/reportAccessRequestController");

// 🔐 Toutes les routes protégées
router.use(authenticate);

// Créer demande d'accès
router.post("/report/:reportId/request", controller.requestAccess);

// Lister pending (direction/admin)
router.get("/pending", authorize("DG", "ADMIN"), controller.getPendingRequests);

// Approve/reject (direction/admin)
router.post("/:id/approve", authorize("DG", "ADMIN"), controller.approveRequest);
router.post("/:id/reject", authorize("DG", "ADMIN"), controller.rejectRequest);

module.exports = router;
