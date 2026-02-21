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
 * AUTH CONTROLLER
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

      // Validation
      if (!email || !password) {
        return errorResponse(
          res,
          "Email et mot de passe requis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Find user
      const user = await User.findByEmail(email);

      if (!user) {
        return unauthorizedResponse(res, "Email ou mot de passe incorrect");
      }

      // Check if active
      if (!user.is_active) {
        return errorResponse(
          res,
          "Compte désactivé. Contactez l'administrateur",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      // Verify password
      const isMatch = await comparePassword(password, user.password);

      if (!isMatch) {
        return unauthorizedResponse(res, "Email ou mot de passe incorrect");
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokenPair(user.id, {
        role: user.role,
        department_id: user.department_id,
      });

      // Update last login
      await User.updateLastLogin(user.id);

      // Audit log
      await AuditLog.create({
        user_id: user.id,
        action: "LOGIN",
        entity_type: "user",
        entity_id: user.id,
        details: { email },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      // Remove password from response
      delete user.password;

      return successResponse(
        res,
        {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            role_name: user.role_name,
            department: {
              id: user.department_id,
              name: user.department_name,
              code: user.department_code,
            },
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
      console.error("Login error:", error);
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
      const user = await User.findByEmail(req.user.email);

      // Verify current password
      const isMatch = await comparePassword(currentPassword, user.password);

      if (!isMatch) {
        return unauthorizedResponse(res, "Mot de passe actuel incorrect");
      }

      // Update password
      await User.updatePassword(req.userId, newPassword);

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
