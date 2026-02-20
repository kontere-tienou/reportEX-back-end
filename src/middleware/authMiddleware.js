const jwt = require("jsonwebtoken");
const db = require("../config/database");

/**
 * 🔐 Auth Middleware
 * - Vérifie le JWT
 * - Recharge l'utilisateur depuis la DB
 * - Injecte req.user sécurisé
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token d'authentification manquant",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔎 Re-vérifier user en base
    const result = await db.query(
      `
      SELECT id, username, full_name, role, department_id, is_active
      FROM users
      WHERE id = $1
      `,
      [decoded.id],
    );

    if (result.rowCount === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur invalide ou désactivé",
      });
    }

    // 🧠 Injecter user complet dans la requête
    req.user = result.rows[0];

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalide ou expiré",
    });
  }
};

/**
 * 🎯 Role-based access control
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Accès non autorisé pour ce rôle",
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  authorizeRoles,
};
