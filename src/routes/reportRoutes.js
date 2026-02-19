const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware, authorizeRoles } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Templates
router.get('/templates/:departmentId', reportController.getTemplates);

// CRUD rapports
router.post('/', reportController.createReport);
router.get('/my-reports', reportController.getMyReports);
router.get('/:id', reportController.getReport);
router.put('/:id', reportController.updateReport);
router.post('/:id/submit', reportController.submitReport);

router.delete("/:id", deleteReport);

router.post("/:id/submit", submitReport);

router.post(
  "/:id/validate",
  authorizeRoles("direction", "admin"),
  validateReport,
);

router.get("/stats/department", getDepartmentStats);

// Validation (seulement pour validateurs et admins)
router.post('/:id/validate',
    authorizeRoles('validateur', 'admin'),
    reportController.validateReport
);

// Statistiques
router.get('/stats/:departmentId', reportController.getDepartmentStats);

module.exports = router;