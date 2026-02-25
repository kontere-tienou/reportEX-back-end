// src/models/departmentModel.js
const db = require("../config/database"); // PostgreSQL connection

const Department = {
  // Create new department
  async create({
    name,
    code,
    description,
    icon = null,
    color = null,
    manager_id = null,
  }) {
    const result = await db.query(
      `
      INSERT INTO departments (name, code, description, icon, color, manager_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [name, code, description || null, icon, color, manager_id, true],
    );
    return result.rows[0];
  },
  // Count departments
  async count(filters = {}) {
    const { is_active } = filters;
    const params = [];
    let i = 1;

    let query = "SELECT COUNT(*) FROM departments WHERE 1=1";

    if (typeof is_active === "boolean") {
      query += ` AND is_active = $${i++}`;
      params.push(is_active);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  },

 //Get all departments (with optional filters)
  async getAll(filters = {}) {
    const { is_active, search } = filters;
    const params = [];
    let i = 1;

    let query = `
      SELECT
        d.id,
        d.name,
        d.code,
        d.description,
        d.icon,
        d.color,
        d.manager_id,
        d.is_active,
        d.created_at,
        d.updated_at,
        u.full_name AS manager_name
      FROM departments d
      LEFT JOIN users u ON u.id = d.manager_id
      WHERE 1=1
    `;

    if (typeof is_active === "boolean") {
      query += ` AND d.is_active = $${i++}`;
      params.push(is_active);
    }

    if (search) {
      query += ` AND (
        LOWER(d.name) LIKE $${i}
        OR LOWER(d.code) LIKE $${i}
        OR LOWER(COALESCE(d.description, '')) LIKE $${i}
      )`;
      params.push(`%${String(search).toLowerCase()}%`);
      i++;
    }

    query += " ORDER BY d.name ASC";

    const result = await db.query(query, params);
    return result.rows;
  },

// Alias for compatibility (controller may call findAll)
  async findAll(filters = {}) {
    return this.getAll(filters);
  },

  // Get department by ID
  async getById(id) {
    const result = await db.query(
      `
      SELECT
        d.*,
        u.full_name AS manager_name
      FROM departments d
      LEFT JOIN users u ON u.id = d.manager_id
      WHERE d.id = $1
      `,
      [id],
    );
    return result.rows[0];
  },

 // Alias for compatibility
  async findById(id) {
    return this.getById(id);
  },
  // Get department by code
  async findByCode(code) {
    const result = await db.query("SELECT * FROM departments WHERE code = $1", [
      code,
    ]);
    return result.rows[0];
  },

 // Update department by ID
  async update(id, updateData = {}) {
    const existing = await this.getById(id);
    if (!existing) return null;

    const payload = {
      name: updateData.name !== undefined ? updateData.name : existing.name,
      code: updateData.code !== undefined ? updateData.code : existing.code,
      description:
        updateData.description !== undefined
          ? updateData.description
          : existing.description,
      icon: updateData.icon !== undefined ? updateData.icon : existing.icon,
      color: updateData.color !== undefined ? updateData.color : existing.color,
      manager_id:
        updateData.manager_id !== undefined
          ? updateData.manager_id
          : existing.manager_id,
      is_active:
        updateData.is_active !== undefined
          ? updateData.is_active
          : existing.is_active,
    };

    const result = await db.query(
      `
      UPDATE departments
      SET
        name = $1,
        code = $2,
        description = $3,
        icon = $4,
        color = $5,
        manager_id = $6,
        is_active = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
      `,
      [
        payload.name,
        payload.code,
        payload.description,
        payload.icon,
        payload.color,
        payload.manager_id,
        payload.is_active,
        id,
      ],
    );

    return result.rows[0];
  },
  // Soft delete (deactivate)
  async deactivate(id) {
    const result = await db.query(
      `
      UPDATE departments
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [id],
    );
    return result.rows[0];
  },
  // Delete department (hard delete)
  async delete(id) {
    const result = await db.query(
      "DELETE FROM departments WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  },
  // Department statistics
  async getDepartmentStats(id) {
    const result = await db.query(
      `
      SELECT
        d.id,
        d.name,
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT r.id) AS total_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'brouillon' THEN r.id END) AS draft_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'soumis' THEN r.id END) AS submitted_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'valide' THEN r.id END) AS validated_reports,
        COUNT(DISTINCT CASE WHEN r.status = 'rejete' THEN r.id END) AS rejected_reports
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      LEFT JOIN reports r ON r.department_id = d.id
      WHERE d.id = $1
      GROUP BY d.id, d.name
      `,
      [id],
    );

    return result.rows[0];
  },
  // Alias for compatibility
  async getStats(id) {
    return this.getDepartmentStats(id);
  },
  
  // get department users
  async getDepartmentUsers(id) {
    const result = await db.query(
      `
      SELECT u.*, d.name AS department_name
      FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE u.department_id = $1 AND u.is_active = true
      `,
      [id],
    );
    return result.rows;
  },
};

module.exports = Department;
