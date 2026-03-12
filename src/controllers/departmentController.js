const { Department, AuditLog } = require("../models");
const {
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * DEPARTMENT CONTROLLER
 * ==========================================
 */
const departmentController = {

  async getAllDepartments(req, res) {
    try {
      const { is_active, search } = req.query;

      const departments = await Department.findAll({
        is_active:
          is_active === "true"
            ? true
            : is_active === "false"
              ? false
              : undefined,
        search,
      });

      return successResponse(res, { departments }, "Départements récupérés");
    } catch (error) {
      console.error("Get departments error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des départements",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },


  async getDepartment(req, res) {
    try {
      const { id } = req.params;

      const department = await Department.findById(id);

      if (!department) {
        return notFoundResponse(res, "Département non trouvé");
      }

      return successResponse(res, { department }, "Département récupéré");
    } catch (error) {
      console.error("Get department error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération du département",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
// get users of a department
  async getDepartmentUsers(req, res) {
    try {
      const { id } = req.params;

      const users = await Department.getDepartmentUsers(id);

      return successResponse(res, { users }, "Utilisateurs du département récupérés");
    } catch (error) {
      console.error("Get department users error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des utilisateurs du département",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
  async createDepartment(req, res) {
    try {
      const { code, name, icon, color, description, manager_id } = req.body;

      // Check if code exists
      const existing = await Department.findByCode(code);

      if (existing) {
        return errorResponse(
          res,
          "Un département avec ce code existe déjà",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Create
      const newDepartment = await Department.create({
        code,
        name,
        icon,
        color,
        description,
        manager_id,
      });

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "CREATE",
        entity_type: "department",
        entity_id: newDepartment.id,
        details: { code, name },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return createdResponse(
        res,
        { department: newDepartment },
        "Département créé avec succès",
      );
    } catch (error) {
      console.error("Create department error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création du département",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if exists
      const existing = await Department.findById(id);

      if (!existing) {
        return notFoundResponse(res, "Département non trouvé");
      }

      // If code is being changed, check uniqueness
      if (updateData.code && updateData.code !== existing.code) {
        const codeExists = await Department.findByCode(updateData.code);
        if (codeExists) {
          return errorResponse(
            res,
            "Un département avec ce code existe déjà",
            HTTP_STATUS.CONFLICT,
          );
        }
      }

      // Update
      const updatedDepartment = await Department.update(id, updateData);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "department",
        entity_id: id,
        details: updateData,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { department: updatedDepartment },
        "Département mis à jour",
      );
    } catch (error) {
      console.error("Update department error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour du département",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

 
  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;

      // Check if exists
      const existing = await Department.findById(id);

      if (!existing) {
        return notFoundResponse(res, "Département non trouvé");
      }

      // Soft delete
      await Department.delete(id);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "DELETE",
        entity_type: "department",
        entity_id: id,
        details: { code: existing.code, name: existing.name },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Département supprimé");
    } catch (error) {
      console.error("Delete department error:", error);
      return errorResponse(
        res,
        "Erreur lors de la suppression du département",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

 
  async getDepartmentStats(req, res) {
    try {
      const { id } = req.params;

      const stats = await Department.getStats(id);

      return successResponse(res, { stats }, "Statistiques récupérées");
    } catch (error) {
      console.error("Get department stats error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des statistiques",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },


};

module.exports = departmentController;
