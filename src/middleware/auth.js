const jwt = require("jsonwebtoken");
const db = require("../config/database");
const config = require("../config/config");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * AUTHENTICATION MIDDLEWARE
 * ==========================================
 */

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token d'authentification manquant",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user from database
    const result = await db.query(
      `SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.department_id,
        u.is_active,
        u.phone,
        u.avatar,
        u.created_at,
        d.name as department_name,
        d.code as department_code,
        r.name as role_name,
        r.level as role_level
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN roles r ON u.role = r.code
       WHERE u.id = $1`,
      [decoded.userId],
    );

    if (result.rowCount === 0) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Utilisateur non trouvé",
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Compte utilisateur désactivé",
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token invalide",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Token expiré",
      });
    }

    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      success: false,
      message: "Erreur d'authentification",
    });
  }
};

/**
 * Authorize based on roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Non authentifié",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Accès refusé. Permissions insuffisantes.",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Authorize based on department
 */
const authorizeDepartment = (...allowedDepartments) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Non authentifié",
      });
    }

    // Admin and DG can access all departments
    if (["ADMIN", "DG"].includes(req.user.role)) {
      return next();
    }

    if (!allowedDepartments.includes(req.user.department_code)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Accès refusé. Département non autorisé.",
        requiredDepartments: allowedDepartments,
        userDepartment: req.user.department_code,
      });
    }

    next();
  };
};

/**
 * Optional authentication (attach user if token present, but don't require it)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret);

      const result = await db.query(
        "SELECT * FROM users WHERE id = $1 AND is_active = true",
        [decoded.userId],
      );

      if (result.rowCount > 0) {
        req.user = result.rows[0];
        req.userId = result.rows[0].id;
      }
    }

    next();
  } catch (error) {
    // Don't fail if token is invalid, just continue without user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeDepartment,
  optionalAuth,
};
