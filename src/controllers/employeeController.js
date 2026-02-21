const { Employee, AuditLog } = require("../models");
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
 * EMPLOYEE CONTROLLER
 * ==========================================
 */

const employeeController = {
  /**
   * Get all employees with pagination
   * GET /api/employees
   */
  async getAllEmployees(req, res) {
    try {
      const { page, limit, department_id, status, contract_type, search } =
        req.query;

      const result = await Employee.findAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        department_id,
        status,
        contract_type,
        search,
      });

      return paginatedResponse(
        res,
        result.employees,
        result.pagination,
        "Employés récupérés",
      );
    } catch (error) {
      console.error("Get employees error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des employés",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get single employee
   * GET /api/employees/:id
   */
  async getEmployee(req, res) {
    try {
      const { id } = req.params;

      const employee = await Employee.findById(id);

      if (!employee) {
        return notFoundResponse(res, "Employé non trouvé");
      }

      return successResponse(res, { employee }, "Employé récupéré");
    } catch (error) {
      console.error("Get employee error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération de l'employé",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Create employee
   * POST /api/employees
   */
  async createEmployee(req, res) {
    try {
      const employeeData = req.body;

      // Check if matricule exists
      const existing = await Employee.findByMatricule(employeeData.matricule);

      if (existing) {
        return errorResponse(
          res,
          "Un employé avec ce matricule existe déjà",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Check if email exists
      if (employeeData.email) {
        const emailExists = await Employee.findByEmail(employeeData.email);
        if (emailExists) {
          return errorResponse(
            res,
            "Un employé avec cet email existe déjà",
            HTTP_STATUS.CONFLICT,
          );
        }
      }

      // Create
      const newEmployee = await Employee.create(employeeData);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "CREATE",
        entity_type: "employee",
        entity_id: newEmployee.id,
        details: {
          matricule: employeeData.matricule,
          name: `${employeeData.first_name} ${employeeData.last_name}`,
        },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return createdResponse(
        res,
        { employee: newEmployee },
        "Employé créé avec succès",
      );
    } catch (error) {
      console.error("Create employee error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création de l'employé",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Update employee
   * PUT /api/employees/:id
   */
  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if exists
      const existing = await Employee.findById(id);

      if (!existing) {
        return notFoundResponse(res, "Employé non trouvé");
      }

      // Update
      const updatedEmployee = await Employee.update(id, updateData);

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "employee",
        entity_id: id,
        details: updateData,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { employee: updatedEmployee },
        "Employé mis à jour",
      );
    } catch (error) {
      console.error("Update employee error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour de l'employé",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Terminate employee
   * PUT /api/employees/:id/terminate
   */
  async terminateEmployee(req, res) {
    try {
      const { id } = req.params;
      const { termination_date, reason } = req.body;

      if (!termination_date || !reason) {
        return errorResponse(
          res,
          "Date de fin et raison sont requises",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const terminatedEmployee = await Employee.terminate(
        id,
        termination_date,
        reason,
      );

      // Audit log
      await AuditLog.create({
        user_id: req.userId,
        action: "UPDATE",
        entity_type: "employee",
        entity_id: id,
        details: { action: "terminated", termination_date, reason },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { employee: terminatedEmployee },
        "Employé résilié",
      );
    } catch (error) {
      console.error("Terminate employee error:", error);
      return errorResponse(
        res,
        "Erreur lors de la résiliation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Search employees
   * GET /api/employees/search
   */
  async searchEmployees(req, res) {
    try {
      const { q } = req.query;

      if (!q) {
        return errorResponse(
          res,
          "Terme de recherche requis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const employees = await Employee.search(q);

      return successResponse(res, { employees }, "Recherche effectuée");
    } catch (error) {
      console.error("Search employees error:", error);
      return errorResponse(
        res,
        "Erreur lors de la recherche",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get employee statistics
   * GET /api/employees/stats
   */
  async getEmployeeStats(req, res) {
    try {
      const { department_id } = req.query;

      const stats = await Employee.getStats({ department_id });

      return successResponse(res, { stats }, "Statistiques récupérées");
    } catch (error) {
      console.error("Get employee stats error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des statistiques",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = employeeController;
