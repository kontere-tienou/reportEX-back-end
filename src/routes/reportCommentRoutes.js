const express = require("express");
const router = express.Router();

const { authMiddleware, authorizeRoles } = require("../middleware/authMiddleware");

const controller = require("../controllers/reportCommentController");

router.use(authMiddleware);

// Ajouter commentaire
router.post("/:reportId/comments", controller.addComment);

// Lister commentaires
router.get("/:reportId/comments", controller.listComments);

// Supprimer commentaire
router.delete("/comments/:id", controller.deleteComment);

module.exports = router;
