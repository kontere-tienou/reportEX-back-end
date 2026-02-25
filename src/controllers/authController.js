const { User } = require("../models");
const { comparePassword } = require("../utils/password");
const { generateTokenPair } = require("../utils/jwt");
const {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");
const AuditLog = require("../models/AuditLog");

/**
 * ==========================================
 * AUTH CONTROLLER (FIXED)
 * ==========================================
 */

const authController = {
  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log("=== LOGIN DEBUG ===");
      console.log("Email reçu:", email);
      console.log("Password reçu (masqué):", password ? "***" : "vide");

      // Validation
      if (!email || !password) {
        console.log("❌ Email ou password manquant");
        return errorResponse(
          res,
          "Email et mot de passe requis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Find user with raw query to see exact data
      const db = require("../config/database");
      const result = await db.query(
        `SELECT 
          u.id, u.email, u.password, u.full_name, u.role, u.department_id,
          u.phone, u.avatar, u.is_active,
          d.name as department_name, d.code as department_code,
          r.name as role_name, r.level as role_level
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN roles r ON u.role = r.code
         WHERE u.email = $1`,
        [email],
      );

      console.log("Résultat query:", result.rowCount, "ligne(s)");

      if (result.rowCount === 0) {
        console.log("❌ Utilisateur non trouvé");
        return unauthorizedResponse(res, "Email ou mot de passe incorrect");
      }

      const user = result.rows[0];
      console.log("✅ Utilisateur trouvé:", user.email);
      console.log(
        "Hash en base:",
        user.password ? user.password.substring(0, 20) + "..." : "null",
      );
      console.log("Active:", user.is_active);

      // Check if active
      if (!user.is_active) {
        console.log("❌ Compte désactivé");
        return errorResponse(
          res,
          "Compte désactivé. Contactez l'administrateur",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      // Verify password with bcrypt directly
      const bcrypt = require("bcryptjs");
      console.log("Vérification password...");

      try {
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Résultat comparaison:", isMatch);

        if (!isMatch) {
          console.log("❌ Mot de passe incorrect");
          return unauthorizedResponse(res, "Email ou mot de passe incorrect");
        }

        console.log("✅ Mot de passe correct");
      } catch (compareError) {
        console.error("Erreur lors de la comparaison bcrypt:", compareError);
        return errorResponse(
          res,
          "Erreur lors de la vérification du mot de passe",
          HTTP_STATUS.INTERNAL_ERROR,
        );
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokenPair(user.id, {
        role: user.role,
        department_id: user.department_id,
      });

      console.log("✅ Tokens générés");

      // Update last login
      await db.query(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
        [user.id],
      );

      // Audit log
      try {
        await AuditLog.create({
          user_id: user.id,
          action: "LOGIN",
          entity_type: "user",
          entity_id: user.id,
          details: { email },
          ip_address: req.ip,
          user_agent: req.get("user-agent"),
        });
      } catch (auditError) {
        console.error("Erreur audit log:", auditError);
        // Continue même si audit log échoue
      }

      // Remove password from response
      delete user.password;

      console.log("✅ LOGIN RÉUSSI");

      return successResponse(
        res,
        {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            role_name: user.role_name,
            role_level: user.role_level,
            department: {
              id: user.department_id,
              name: user.department_name,
              code: user.department_code,
            },
            phone: user.phone,
            avatar: user.avatar,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        "Connexion réussie",
        HTTP_STATUS.OK,
      );
    } catch (error) {
      console.error("❌ LOGIN ERROR:", error);
      console.error("Stack:", error.stack);
      return errorResponse(
        res,
        "Erreur lors de la connexion",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId);

      if (!user) {
        return errorResponse(
          res,
          "Utilisateur non trouvé",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // Remove password
      delete user.password;

      return successResponse(res, { user }, "Profil récupéré");
    } catch (error) {
      console.error("Get profile error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération du profil",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Change password
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return errorResponse(
          res,
          "Tous les champs sont requis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Get user with password
      const db = require("../config/database");
      const result = await db.query(
        "SELECT password FROM users WHERE id = $1",
        [req.userId],
      );

      if (result.rowCount === 0) {
        return errorResponse(
          res,
          "Utilisateur non trouvé",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      const user = result.rows[0];

      // Verify current password
      const bcrypt = require("bcryptjs");
      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return unauthorizedResponse(res, "Mot de passe actuel incorrect");
      }

      // Hash new password
      const { hashPassword } = require("../utils/password");
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await db.query(
        "UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [hashedPassword, req.userId],
      );

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "user",
        entity_id: req.userId,
        details: { action: "password_changed" },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Mot de passe modifié avec succès");
    } catch (error) {
      console.error("Change password error:", error);
      return errorResponse(
        res,
        "Erreur lors du changement de mot de passe",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Register new user (Admin only)
   * POST /api/auth/register
   */
  async registerUser(req, res) {
    try {
      const { email, password, full_name, role, department_id, phone } =
        req.body;

      // Validation
      if (!email || !password || !full_name || !role || !department_id) {
        return errorResponse(
          res,
          "Tous les champs requis doivent être remplis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Check if user exists
      const existing = await User.findByEmail(email);

      if (existing) {
        return errorResponse(
          res,
          "Un utilisateur avec cet email existe déjà",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Create user
      const newUser = await User.create({
        email,
        password,
        full_name,
        role,
        department_id,
        phone,
      });

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "CREATE",
        entity_type: "user",
        entity_id: newUser.id,
        details: { email, role, department_id },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      // Remove password from response
      delete newUser.password;

      return successResponse(
        res,
        { user: newUser },
        "Utilisateur créé avec succès",
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      console.error("Register error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création de l'utilisateur",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "LOGOUT",
        entity_type: "user",
        entity_id: req.userId,
        details: {},
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Déconnexion réussie");
    } catch (error) {
      console.error("Logout error:", error);
      return errorResponse(
        res,
        "Erreur lors de la déconnexion",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = authController;
