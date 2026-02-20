const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

const { authMiddleware, authorizeRoles } = require("../middleware/auth");

// 🔐 Toutes les routes protégées
router.use(authMiddleware);

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUser);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.patch("/:id/status", userController.toggleUserStatus);
router.delete("/:id", userController.deleteUser);

module.exports = router;
