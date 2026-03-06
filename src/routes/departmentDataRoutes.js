const express = require("express");
const router = express.Router();
const departmentDataController = require("../controllers/departmentDataController");
const { apiLimiter, createLimiter } = require("../middleware/rateLimiter");
const { authenticate } = require("../middleware/auth");

// Create specific limiters for data endpoints
const dataLimiter = createLimiter(1, 30);
const aggregatedLimiter = createLimiter(1, 15); 

// Apply authentication to all routes
router.use(authenticate);

// Data endpoints with rate limiting
router.get("/:deptCode/data", departmentDataController.getAll);
router.get(
  "/:deptCode/data/aggregated",
  departmentDataController.getAggregated,
);
//router.get("/:deptCode/data", dataLimiter, departmentDataController.getAll);
router.get("/:deptCode/data/:id", dataLimiter, departmentDataController.getOne);
router.post("/:deptCode/data", apiLimiter, departmentDataController.create);
router.put("/:deptCode/data/:id", apiLimiter, departmentDataController.update);
router.delete(
  "/:deptCode/data/:id",
  apiLimiter,
  departmentDataController.delete,
);

// Stats and aggregated endpoints - stricter limits
router.get(
  "/:deptCode/data/stats",
  aggregatedLimiter,
  departmentDataController.getStats,
);
/*router.get(
  "/:deptCode/data/aggregated",
  aggregatedLimiter,
  departmentDataController.getAggregated,
);*/
router.get(
  "/:deptCode/data/export",
  createLimiter(5, 5),
  departmentDataController.exportData,
);

module.exports = router;
