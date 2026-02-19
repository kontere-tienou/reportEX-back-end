const db = require("../config/database");

const reportModel = {
  /* ======================================================
     CREATE
  ====================================================== */
  async create(data) {
    const query = `
      INSERT INTO reports
      (template_id, user_id, department_id,
       period_start, period_end,
       data, status, visibility)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const values = [
      data.template_id,
      data.user_id,
      data.department_id,
      data.period_start,
      data.period_end,
      data.data,
      data.status || "brouillon",
      data.visibility || "private",
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /* ======================================================
     FIND ALL (Direction)
  ====================================================== */
  async findAll(filters = {}) {
    let query = `
      SELECT r.*, 
             t.name as template_name,
             d.name as department_name,
             u.full_name as author_name
      FROM reports r
      JOIN report_templates t ON r.template_id = t.id
      JOIN departments d ON r.department_id = d.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (filters.status) {
      query += ` AND r.status = $${index++}`;
      values.push(filters.status);
    }

    if (filters.department_id) {
      query += ` AND r.department_id = $${index++}`;
      values.push(filters.department_id);
    }

    if (filters.visibility) {
      query += ` AND r.visibility = $${index++}`;
      values.push(filters.visibility);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  },

  /* ======================================================
     FIND BY DEPARTMENT
  ====================================================== */
  async findByDepartment(departmentId, filters = {}) {
    let query = `
      SELECT r.*, 
             t.name as template_name
      FROM reports r
      JOIN report_templates t ON r.template_id = t.id
      WHERE r.department_id = $1
    `;

    const values = [departmentId];
    let index = 2;

    if (filters.status) {
      query += ` AND r.status = $${index++}`;
      values.push(filters.status);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  },

  /* ======================================================
     FIND ONE
  ====================================================== */
  async findById(reportId) {
    const result = await db.query(
      `
      SELECT r.*, 
             t.name as template_name,
             t.frequency,
             d.name as department_name,
             u.full_name as author_name,
             v.full_name as validator_name
      FROM reports r
      JOIN report_templates t ON r.template_id = t.id
      JOIN departments d ON r.department_id = d.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users v ON r.validated_by = v.id
      WHERE r.id = $1
      `,
      [reportId],
    );

    return result.rows[0] || null;
  },

  /* ======================================================
     UPDATE DATA
  ====================================================== */
  async update(reportId, fields) {
    const query = `
      UPDATE reports
      SET data = $1,
          visibility = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    const values = [fields.data, fields.visibility, reportId];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /* ======================================================
     UPDATE STATUS
  ====================================================== */
  async updateStatus(reportId, statusFields) {
    const query = `
      UPDATE reports
      SET status = $1,
          validated_at = $2,
          validated_by = $3,
          rejection_reason = $4,
          is_locked = $5,
          submitted_at = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *;
    `;

    const values = [
      statusFields.status,
      statusFields.validated_at || null,
      statusFields.validated_by || null,
      statusFields.rejection_reason || null,
      statusFields.is_locked || false,
      statusFields.submitted_at || null,
      reportId,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  },

  /* ======================================================
     DELETE
  ====================================================== */
  async delete(reportId) {
    await db.query(`DELETE FROM reports WHERE id = $1`, [reportId]);
    return true;
  },

  /* ======================================================
     CHECK LOCK
  ====================================================== */
  async isLocked(reportId) {
    const result = await db.query(
      `SELECT is_locked FROM reports WHERE id = $1`,
      [reportId],
    );

    if (!result.rows.length) return false;
    return result.rows[0].is_locked;
  },

  /* ======================================================
     STATS BY DEPARTMENT
  ====================================================== */
  async getDepartmentStats(departmentId) {
    const result = await db.query(
      `
      SELECT
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status='valide' THEN 1 END) as validated,
        COUNT(CASE WHEN status='soumis' THEN 1 END) as pending,
        COUNT(CASE WHEN status='rejete' THEN 1 END) as rejected,
        COUNT(CASE WHEN status='brouillon' THEN 1 END) as draft
      FROM reports
      WHERE department_id = $1
      `,
      [departmentId],
    );

    return result.rows[0];
  },
};

module.exports = reportModel;
