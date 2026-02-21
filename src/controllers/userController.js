const { User, AuditLog } = require("../models");
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * USER CONTROLLER
 * ==========================================
 */

const userController = {
  /**
   * Get all users with pagination
   * GET /api/users
   */
  async getAllUsers(req, res) {
    try {
      const { page, limit, role, department_id, is_active, search } = req.query;

      const result = await User.findAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        role,
        department_id,
        is_active:
          is_active === "true"
            ? true
            : is_active === "false"
              ? false
              : undefined,
        search,
      });

      return paginatedResponse(
        res,
        result.users,
        result.pagination,
        "Utilisateurs récupérés",
      );
    } catch (error) {
      console.error("Get all users error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des utilisateurs",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get single user
   * GET /api/users/:id
   */
  async getUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

      if (!user) {
        return notFoundResponse(res, "Utilisateur non trouvé");
      }

      // Remove password
      delete user.password;

      return successResponse(res, { user }, "Utilisateur récupéré");
    } catch (error) {
      console.error("Get user error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération de l'utilisateur",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Create new user
   * POST /api/users
   */
  async createUser(req, res) {
    try {
      const { email, password, full_name, role, department_id, phone } =
        req.body;

      // Check if exists
      const existing = await User.findByEmail(email);

      if (existing) {
        return errorResponse(
          res,
          "Un utilisateur avec cet email existe déjà",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Create
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

      // Remove password
      delete newUser.password;

      return createdResponse(
        res,
        { user: newUser },
        "Utilisateur créé avec succès",
      );
    } catch (error) {
      console.error("Create user error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création de l'utilisateur",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Update user
   * PUT /api/users/:id
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if exists
      const existing = await User.findById(id);

      if (!existing) {
        return notFoundResponse(res, "Utilisateur non trouvé");
      }

      // Update
      const updatedUser = await User.update(id, updateData);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "user",
        entity_id: id,
        details: updateData,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { user: updatedUser },
        "Utilisateur mis à jour",
      );
    } catch (error) {
      console.error("Update user error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour de l'utilisateur",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Activate user
   * PUT /api/users/:id/activate
   */
  async activateUser(req, res) {
    try {
      const { id } = req.params;

      await User.activate(id);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "user",
        entity_id: id,
        details: { action: "activated" },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Utilisateur activé");
    } catch (error) {
      console.error("Activate user error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'activation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Deactivate user
   * PUT /api/users/:id/deactivate
   */
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      await User.deactivate(id);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "user",
        entity_id: id,
        details: { action: "deactivated" },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Utilisateur désactivé");
    } catch (error) {
      console.error("Deactivate user error:", error);
      return errorResponse(
        res,
        "Erreur lors de la désactivation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existing = await User.findById(id);

      if (!existing) {
        return notFoundResponse(res, "Utilisateur non trouvé");
      }

      await User.delete(id);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "DELETE",
        entity_type: "user",
        entity_id: id,
        details: { email: existing.email },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Utilisateur supprimé");
    } catch (error) {
      console.error("Delete user error:", error);
      return errorResponse(
        res,
        "Erreur lors de la suppression",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  async getUserStats(req, res) {
    try {
      const { department_id, role } = req.query;

      const total = await User.count({ department_id, role });
      const active = await User.count({ department_id, role, is_active: true });
      const inactive = await User.count({
        department_id,
        role,
        is_active: false,
      });

      return successResponse(
        res,
        {
          stats: {
            total,
            active,
            inactive,
          },
        },
        "Statistiques récupérées",
      );
    } catch (error) {
      console.error("Get user stats error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des statistiques",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = userController;
