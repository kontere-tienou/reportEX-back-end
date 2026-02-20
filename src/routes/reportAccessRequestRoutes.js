const express = require("express");
const router = express.Router();

const {
  authMiddleware,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const controller = require("../controllers/reportAccessRequestController");

router.use(authMiddleware);

// Créer demande d'accès
router.post("/report/:reportId/request", controller.requestAccess);

// Lister pending (direction/admin)
router.get(
  "/pending",
  authorizeRoles("direction", "admin"),
  controller.listPending,
);

// Approve/reject (direction/admin)
router.post(
  "/:id/approve",
  authorizeRoles("direction", "admin"),
  controller.approve,
);
router.post(
  "/:id/reject",
  authorizeRoles("direction", "admin"),
  controller.reject,
);

module.exports = router;
