const db = require("../config/database");

const reportAccessRequestModel = {
  async create(reportId, departmentId) {
    const result = await db.query(
      `
      INSERT INTO report_access_requests
      (report_id, requesting_department_id)
      VALUES ($1,$2)
      RETURNING *;
      `,
      [reportId, departmentId],
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM report_access_requests WHERE id=$1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findPending() {
    const result = await db.query(
      `
      SELECT r.*, d.name as department_name
      FROM report_access_requests r
      JOIN departments d ON r.requesting_department_id=d.id
      WHERE r.status='pending'
      ORDER BY r.created_at DESC
      `,
    );
    return result.rows;
  },

  async approve(id, reviewerId) {
    const result = await db.query(
      `
      UPDATE report_access_requests
      SET status='approved',
          reviewed_by=$1,
          reviewed_at=CURRENT_TIMESTAMP
      WHERE id=$2
      RETURNING *;
      `,
      [reviewerId, id],
    );
    return result.rows[0];
  },

  async reject(id, reviewerId) {
    const result = await db.query(
      `
      UPDATE report_access_requests
      SET status='rejected',
          reviewed_by=$1,
          reviewed_at=CURRENT_TIMESTAMP
      WHERE id=$2
      RETURNING *;
      `,
      [reviewerId, id],
    );
    return result.rows[0];
  },

  async hasApprovedAccess(reportId, departmentId) {
    const result = await db.query(
      `
      SELECT id FROM report_access_requests
      WHERE report_id=$1
      AND requesting_department_id=$2
      AND status='approved'
      `,
      [reportId, departmentId],
    );
    return result.rows.length > 0;
  },
};

module.exports = reportAccessRequestModel;
