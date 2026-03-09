const express = require("express");
const router = express.Router();
const departmentDataController = require("../controllers/departmentDataController");
//const {  } = require("../middleware/rateLimiter");
const { authenticate } = require("../middleware/auth");
const {apiLimiter, createLimiter, batchLimiter } = require("../middleware/rateLimiter");

// Create specific limiters for data endpoints
const dataLimiter = createLimiter(1, 30);
const aggregatedLimiter = createLimiter(1, 15);

// Apply authentication to all routes
router.use(authenticate);

// Static routes first
router.get(
  "/:deptCode/data/stats",
  aggregatedLimiter,
  departmentDataController.getStats,
);
router.get(
  "/:deptCode/data/aggregated",
  departmentDataController.getAggregated,
);

router.post("/:deptCode/data/batch", batchLimiter, departmentDataController.getBatchData);
router.post("/:deptCode/data/batch-chart", batchLimiter, departmentDataController.getBatchChartData);
router.post(
  "/:deptCode/data/pie",
  batchLimiter,
  departmentDataController.getPieData,
);

// Optional: Multi-department batch endpoint
router.post("/data/batch-stats", batchLimiter, departmentDataController.getBatchStats);
router.get(
  "/:deptCode/data/export",
  createLimiter(5, 5),
  departmentDataController.exportData,
);

// Generic collection routes
router.get("/:deptCode/data", departmentDataController.getAll);
router.post("/:deptCode/data", apiLimiter, departmentDataController.create);

// Dynamic ID routes last
router.get("/:deptCode/data/:id", dataLimiter, departmentDataController.getOne);
router.put("/:deptCode/data/:id", apiLimiter, departmentDataController.update);
router.delete(
  "/:deptCode/data/:id",
  apiLimiter,
  departmentDataController.delete,
);

module.exports = router;
