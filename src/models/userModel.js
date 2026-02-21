const db = require("../config/database");
const { hashPassword } = require("../utils/password");

/**
 * ==========================================
 * USER MODEL
 * ==========================================
 */

class User {
  /**
   * Create new user
   */
  static async create(userData) {
    const { email, password, full_name, role, department_id, phone, avatar } =
      userData;

    const hashedPassword = await hashPassword(password);

    const result = await db.query(
      `INSERT INTO users (
        email, password, full_name, role, department_id, 
        phone, avatar, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, full_name, role, department_id, phone, avatar, is_active, created_at`,
      [email, hashedPassword, full_name, role, department_id, phone, avatar],
    );

    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const result = await db.query(
      `SELECT 
        u.id, u.email, u.full_name, u.role, u.department_id,
        u.phone, u.avatar, u.is_active, u.last_login, u.created_at, u.updated_at,
        d.name as department_name, d.code as department_code,
        r.name as role_name, r.level as role_level
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role = r.code
      WHERE u.id = $1`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const result = await db.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    return result.rows[0];
  }

  /**
   * Get all users with filters
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      role,
      department_id,
      is_active,
      search,
    } = filters;

    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT 
        u.id, u.email, u.full_name, u.role, u.department_id,
        u.phone, u.is_active, u.last_login, u.created_at,
        d.name as department_name,
        r.name as role_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN roles r ON u.role = r.code
      WHERE 1=1
    `;

    if (role) {
      query += ` AND u.role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    if (department_id) {
      query += ` AND u.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND u.is_active = $${paramCount}`;
      params.push(is_active);
      paramCount++;
    }

    if (search) {
      query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, "SELECT COUNT(*) FROM");
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user
   */
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== "id" && key !== "password") {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, role, department_id, phone, avatar, is_active, updated_at
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update password
   */
  static async updatePassword(id, newPassword) {
    const hashedPassword = await hashPassword(newPassword);

    const result = await db.query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id`,
      [hashedPassword, id],
    );

    return result.rows[0];
  }

  /**
   * Update last login
   */
  static async updateLastLogin(id) {
    await db.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
  }

  /**
   * Deactivate user
   */
  static async deactivate(id) {
    const result = await db.query(
      `UPDATE users 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Activate user
   */
  static async activate(id) {
    const result = await db.query(
      `UPDATE users 
       SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Delete user (soft delete)
   */
  static async delete(id) {
    const result = await db.query(
      `UPDATE users 
       SET is_active = false, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Count users
   */
  static async count(filters = {}) {
    const { role, department_id, is_active } = filters;
    const params = [];
    let paramCount = 1;

    let query = "SELECT COUNT(*) FROM users WHERE 1=1";

    if (role) {
      query += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    if (department_id) {
      query += ` AND department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramCount}`;
      params.push(is_active);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
  }
}

module.exports = User;
