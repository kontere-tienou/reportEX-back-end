const express = require("express");
const router = express.Router({ mergeParams: true });
const departmentDataController = require("../controllers/departmentDataController");
const { authenticate, authorize } = require("../middleware/auth");


/**
 * ==========================================
 * DEPARTMENT DATA ROUTES
 * ==========================================
 */




router.use(authenticate);

router.get("/stats", departmentDataController.getStats);
router.get("/aggregated", departmentDataController.getAggregated);
router.get("/export", departmentDataController.exportData);
// CRUD operations
router.get("/", departmentDataController.getAll);
router.get("/:id", departmentDataController.getOne);
router.post("/", departmentDataController.create);
router.put("/:id", departmentDataController.update);
router.delete("/:id", departmentDataController.delete);


module.exports = router;
