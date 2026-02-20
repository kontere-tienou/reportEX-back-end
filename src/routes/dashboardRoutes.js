const express = require("express");
const router = express.Router();

const controller = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");

router.get(
  "/direction",
  authorizeRoles("direction", "admin"),
  controller.getDirectionDashboard,
);



module.exports = router;