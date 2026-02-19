const express = require("express");
const router = express.Router();

const controller = require("../controllers/reportAccessRequestController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");

router.use(authMiddleware);

/* Demander accès */
router.post("/report/:reportId/request", controller.requestAccess);

/* Voir demandes (Direction/Admin) */
router.get(
  "/pending",
  authorizeRoles("direction", "admin"),
  controller.getPending,
);

/* Approuver */
router.post(
  "/:id/approve",
  authorizeRoles("direction", "admin"),
  controller.approve,
);

/* Rejeter */
router.post(
  "/:id/reject",
  authorizeRoles("direction", "admin"),
  controller.reject,
);

module.exports = router;
