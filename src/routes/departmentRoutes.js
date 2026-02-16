const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const { authMiddleware } = require("../middleware/auth");

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Routes pour les départements
router.get("/", departmentController.getAllDepartments);
router.get("/:id", departmentController.getDepartment);
router.get("/:id/users", departmentController.getDepartmentUsers); 
router.get("/:id/employees", departmentController.getDepartmentEmployees); 
//router.get("/:id/stats", departmentController.getDepartmentStats); 
router.post("/", departmentController.createDepartment);
router.put("/:id", departmentController.updateDepartment);
router.put("/:id/deactivate", departmentController.deactivateDepartment); 
router.delete("/:id", departmentController.deleteDepartment); 

module.exports = router;
