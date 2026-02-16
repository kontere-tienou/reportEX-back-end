// /models/departmentModel.js

const db = require("../config/database"); // PostgreSQL connection

// Department model
const Department = {
  // Create new department
  async create({ name, code, description }) {
    const result = await db.query(
      "INSERT INTO departments (name, code, description, is_active) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, code, description, true],
    );
    return result.rows[0];
  },

  // Get all active departments
  async getAll() {
    const result = await db.query(
      "SELECT id, name, code, description, is_active FROM departments WHERE is_active = true ORDER BY name",
    );
    return result.rows;
  },

  // Get a specific department by ID
  async getById(id) {
    const result = await db.query("SELECT * FROM departments WHERE id = $1", [
      id,
    ]);
    return result.rows[0];
  },

  // Update a department by ID
  async update(id, { name, code, description }) {
    const result = await db.query(
      "UPDATE departments SET name = $1, code = $2, description = $3 WHERE id = $4 RETURNING *",
      [name, code, description, id],
    );
    return result.rows[0];
  },

  // Deactivate a department by ID
  async deactivate(id) {
    const result = await db.query(
      "UPDATE departments SET is_active = false WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  },

  // Delete a department by ID (if needed)
  async delete(id) {
    const result = await db.query(
      "DELETE FROM departments WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  },

  // Get department user count and report count
  async getDepartmentStats(id) {
    const result = await db.query(
      `SELECT d.name, COUNT(DISTINCT u.id) AS total_users, COUNT(DISTINCT r.id) AS total_reports
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
       LEFT JOIN reports r ON r.department_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id],
    );
    return result.rows[0];
  },
  
};



module.exports = Department;
