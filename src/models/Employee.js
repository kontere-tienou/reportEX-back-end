const db = require("../config/database");

/**
 * ==========================================
 * EMPLOYEE MODEL
 * ==========================================
 */

const Employee = {
  /*
Create new employee
   */
   async create(data) {
    const {
      matricule,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      hire_date,
      department_id,
      position,
      contract_type,
      salary,
      photo,
      address,
      emergency_contact,
      bank_account,
      social_security_number,
    } = data;

    const result = await db.query(
      `INSERT INTO employees (
        matricule, first_name, last_name, email, phone,
        date_of_birth, hire_date, department_id, position,
        contract_type, salary, photo, address, emergency_contact,
        bank_account, social_security_number, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        matricule,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        hire_date,
        department_id,
        position,
        contract_type,
        salary,
        photo,
        address,
        emergency_contact,
        bank_account,
        social_security_number,
      ],
    );

    return result.rows[0];
  },

  /**
   * Find employee by ID
   */
   async findById(id) {
    const result = await db.query(
      `SELECT 
        e.*,
        d.name as department_name,
        d.code as department_code,
        (SELECT COUNT(*) FROM leaves WHERE employee_id = e.id AND status = 'approved') as total_leaves,
        (SELECT COUNT(*) FROM contracts WHERE employee_id = e.id) as total_contracts
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.id = $1`,
      [id],
    );

    return result.rows[0];
  },

  /**
   * Find by matricule
   */
   async findByMatricule(matricule) {
    const result = await db.query(
      "SELECT * FROM employees WHERE matricule = $1",
      [matricule],
    );

    return result.rows[0];
  },

  /**
   * Find by email
   */
   async findByEmail(email) {
    const result = await db.query("SELECT * FROM employees WHERE email = $1", [
      email,
    ]);

    return result.rows[0];
  },

  /**
   * Get all employees with filters
   */
   async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      department_id,
      status,
      contract_type,
      search,
    } = filters;

    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT 
        e.id, e.matricule, e.first_name, e.last_name, e.email, e.phone,
        e.hire_date, e.position, e.contract_type, e.status,
        d.name as department_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

    if (department_id) {
      query += ` AND e.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (status) {
      query += ` AND e.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (contract_type) {
      query += ` AND e.contract_type = $${paramCount}`;
      params.push(contract_type);
      paramCount++;
    }

    if (search) {
      query += ` AND (
        e.first_name ILIKE $${paramCount} OR 
        e.last_name ILIKE $${paramCount} OR 
        e.matricule ILIKE $${paramCount} OR
        e.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, "SELECT COUNT(*) FROM");
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY e.hire_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      employees: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /* Update employee*/
   async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== "id") {
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
      UPDATE employees 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /**
   * Terminate employee
   */
   async terminate(id, termination_date, reason) {
    const result = await db.query(
      `UPDATE employees 
       SET status = 'terminated', 
           termination_date = $1,
           termination_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [termination_date, reason, id],
    );

    return result.rows[0];
  },

  /**
   * Get employee stats
   */
   async getStats(filters = {}) {
    const { department_id } = filters;
    const params = [];
    let whereClause = "";

    if (department_id) {
      whereClause = "WHERE department_id = $1";
      params.push(department_id);
    }

    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'on_leave' THEN 1 END) as on_leave,
        COUNT(CASE WHEN status = 'terminated' THEN 1 END) as terminated,
        COUNT(CASE WHEN contract_type = 'CDI' THEN 1 END) as cdi,
        COUNT(CASE WHEN contract_type = 'CDD' THEN 1 END) as cdd
       FROM employees ${whereClause}`,
      params,
    );

    return result.rows[0];
  },

  /**
   * Search employees
   */
   async search(searchTerm) {
    const result = await db.query(
      `SELECT 
        e.id, e.matricule, e.first_name, e.last_name, e.email, 
        e.position, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE 
        e.first_name ILIKE $1 OR 
        e.last_name ILIKE $1 OR 
        e.matricule ILIKE $1 OR
        e.email ILIKE $1
       ORDER BY e.last_name ASC
       LIMIT 20`,
      [`%${searchTerm}%`],
    );

    return result.rows;
  },

  /**
   * Count employees
   */
   async count(filters = {}) {
    const { department_id, status } = filters;
    const params = [];
    let paramCount = 1;

    let query = "SELECT COUNT(*) FROM employees WHERE 1=1";

    if (department_id) {
      query += ` AND department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Employee;
