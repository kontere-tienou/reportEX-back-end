// /routes/itRoutes.js

const express = require("express");
const router = express.Router();
const itController = require("../controllers/ITConrtoller");
const { authMiddleware, authorizeRoles } = require("../middleware/auth");

// Toutes les routes IT nécessitent une authentification
router.use(authMiddleware);

// Route pour récupérer tous les tickets IT
router.get("/tickets", itController.getTickets); 
// Route pour créer un nouveau ticket IT
router.post(
  "/tickets",
  authorizeRoles("admin", "it-support"),
  itController.createTicket,
);
// Route pour mettre à jour le statut d'un ticket IT
router.put(
  "/tickets/:id",
  authorizeRoles("admin", "it-support"),
  itController.updateTicket,
); 
// Route pour supprimer un ticket IT
router.delete(
  "/tickets/:id",
  authorizeRoles("admin", "it-support"),
  itController.deleteTicket,
); 
// Route pour récupérer les détails d'un ticket spécifique
router.get("/tickets/:id", itController.getTicketById); 
// Route pour assigner un ticket à un technicien IT
router.put(
  "/tickets/:id/assign",
  authorizeRoles("admin", "it-support"),
  itController.assignTicket,
);
router.get('/systems/status', itController.getSystemStatus); 
router.put('/systems/:id/status', authorizeRoles('admin', 'it-admin'), itController.updateSystemStatus);

module.exports = router;
