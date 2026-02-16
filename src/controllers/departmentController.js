const db = require("../config/database");

const departmentController = {
  // Créer un nouveau département
  async createDepartment(req, res) {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Name and code are required." });
    }

    try {
      const existingDept = await db.query(
        "SELECT * FROM departments WHERE code = $1",
        [code],
      );

      if (existingDept.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "Department code already exists." });
      }

      const newDept = await db.query(
        "INSERT INTO departments (name, code, description) VALUES ($1, $2, $3) RETURNING *",
        [name, code, description],
      );

      res
        .status(201)
        .json({
          success: true,
          message: "Department created successfully",
          department: newDept.rows[0],
        });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error creating department" });
    }
  },

  // Mettre à jour un département
  async updateDepartment(req, res) {
    const { id } = req.params;
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Name and code are required." });
    }

    try {
      // Check if department with the same code already exists
      const existingDept = await db.query(
        "SELECT * FROM departments WHERE code = $1 AND id != $2",
        [code, id],
      );

      if (existingDept.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "Department code already exists." });
      }

      const result = await db.query(
        `UPDATE departments SET name = $1, code = $2, description = $3 WHERE id = $4 RETURNING *`,
        [name, code, description, id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found." });
      }

      res
        .status(200)
        .json({
          success: true,
          message: "Department updated successfully",
          department: result.rows[0],
        });
    } catch (error) {
      console.error("Error updating department:", error);
      res
        .status(500)
        .json({ success: false, message: "Error updating department" });
    }
  },

  // Désactiver un département
  async deactivateDepartment(req, res) {
    const { id } = req.params;

    try {
      const result = await db.query(
        `UPDATE departments SET is_active = false WHERE id = $1 RETURNING *`,
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      res
        .status(200)
        .json({
          success: true,
          message: "Department deactivated successfully",
          department: result.rows[0],
        });
    } catch (error) {
      console.error("Error deactivating department:", error);
      res
        .status(500)
        .json({ success: false, message: "Error deactivating department" });
    }
  },

  // Supprimer un département
  async deleteDepartment(req, res) {
    const { id } = req.params;

    try {
      // Check if the department is linked to active users or reports
      const userCount = await db.query(
        "SELECT COUNT(*) FROM users WHERE department_id = $1",
        [id],
      );
      const reportCount = await db.query(
        "SELECT COUNT(*) FROM reports WHERE department_id = $1",
        [id],
      );

      if (
        parseInt(userCount.rows[0].count) > 0 ||
        parseInt(reportCount.rows[0].count) > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot delete department with active users or reports.",
          });
      }

      const result = await db.query(
        "DELETE FROM departments WHERE id = $1 RETURNING *",
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      res
        .status(500)
        .json({ success: false, message: "Error deleting department" });
    }
  },

  // Récupérer tous les départements avec pagination
  async getAllDepartments(req, res) {
    const { page = 1, limit = 20 } = req.query; // Default page is 1, and limit is 20

    try {
      const offset = (page - 1) * limit;
      const result = await db.query(
        `SELECT id, name, code, description, is_active
         FROM departments
         WHERE is_active = true
         ORDER BY name
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      const countResult = await db.query(
        `SELECT COUNT(*) as total_departments FROM departments WHERE is_active = true`,
      );
      const totalDepartments = countResult.rows[0].total_departments;
      const totalPages = Math.ceil(totalDepartments / limit);

      res.json({
        success: true,
        departments: result.rows,
        pagination: {
          totalDepartments,
          totalPages,
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving departments",
      });
    }
  },

  // Récupérer un département spécifique
  async getDepartment(req, res) {
    const { id } = req.params;

    try {
      const result = await db.query(
        `SELECT d.*, 
          COUNT(DISTINCT u.id) as total_users, 
          COUNT(DISTINCT e.id) as total_employees
         FROM departments d
         LEFT JOIN users u ON d.id = u.department_id
         LEFT JOIN users e ON d.id = e.department_id AND e.role NOT IN ('admin', 'validateur') AND e.is_active = true
         WHERE d.id = $1
         GROUP BY d.id, d.name, d.code, d.description, d.is_active`,
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Department not found" });
      }

      res.json({
        success: true,
        department: result.rows[0],
      });
    } catch (error) {
      console.error("Error retrieving department stats:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving department stats",
      });
    }
  },

  // Récupérer tous les utilisateurs d'un département
  async getDepartmentUsers(req, res) {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query; // Pagination

    try {
      const offset = (page - 1) * limit;
      const result = await db.query(
        `SELECT id, username, email, full_name, role, department_id, is_active
         FROM users
         WHERE department_id = $1
         ORDER BY full_name
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );

      const countResult = await db.query(
        `SELECT COUNT(*) as total_users FROM users WHERE department_id = $1`,
        [id],
      );
      const totalUsers = countResult.rows[0].total_users;
      const totalPages = Math.ceil(totalUsers / limit);

      res.json({
        success: true,
        users: result.rows,
        pagination: {
          totalUsers,
          totalPages,
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      console.error("Error retrieving department users:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving department users",
      });
    }
  },

  // Récupérer tous les employés d'un département
  async getDepartmentEmployees(req, res) {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query; // Pagination

    try {
      const offset = (page - 1) * limit;
      const result = await db.query(
        `SELECT id, username, email, full_name, role, department_id, is_active
         FROM users
         WHERE department_id = $1 AND role NOT IN ('admin', 'validateur') AND is_active = true
         ORDER BY full_name
         LIMIT $2 OFFSET $3`,
        [id, limit, offset],
      );

      const countResult = await db.query(
        `SELECT COUNT(*) as total_employees FROM users WHERE department_id = $1 AND role NOT IN ('admin', 'validateur') AND is_active = true`,
        [id],
      );
      const totalEmployees = countResult.rows[0].total_employees;
      const totalPages = Math.ceil(totalEmployees / limit);

      res.json({
        success: true,
        employees: result.rows,
        pagination: {
          totalEmployees,
          totalPages,
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      console.error("Error retrieving department employees:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving department employees",
      });
    }
  },
};

module.exports = departmentController;
