const express = require("express");
const router = express.Router();

const controller = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middleware/auth");

router.get(
  "/direction",
  authorize("DG", "ADMIN"),
  controller.getDirectionDashboard,
);



module.exports = router;