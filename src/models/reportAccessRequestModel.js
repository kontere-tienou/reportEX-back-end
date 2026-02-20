const db = require("../config/database");

const reportAccessRequestModel = {
  async create({ reportId, requesterId, requesterDepartmentId }) {
    const result = await db.query(
      `
      INSERT INTO report_access_requests
        (report_id, requester_id, requester_department_id)
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      [reportId, requesterId, requesterDepartmentId],
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM report_access_requests WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findPendingByReportAndDept(reportId, requesterDepartmentId) {
    const result = await db.query(
      `
      SELECT * FROM report_access_requests
      WHERE report_id = $1
        AND requester_department_id = $2
        AND status = 'pending'
      LIMIT 1
      `,
      [reportId, requesterDepartmentId],
    );
    return result.rows[0] || null;
  },

  async listPending() {
    const result = await db.query(
      `
      SELECT rar.*,
             d.name AS requester_department_name,
             u.full_name AS requester_name,
             r.department_id AS report_department_id,
             rd.name AS report_department_name,
             t.name AS template_name,
             r.period_start, r.period_end, r.status AS report_status
      FROM report_access_requests rar
      JOIN users u ON u.id = rar.requester_id
      JOIN departments d ON d.id = rar.requester_department_id
      JOIN reports r ON r.id = rar.report_id
      JOIN departments rd ON rd.id = r.department_id
      JOIN report_templates t ON t.id = r.template_id
      WHERE rar.status = 'pending'
      ORDER BY rar.created_at DESC
      `,
    );
    return result.rows;
  },

  async approve(id, reviewerId) {
    const result = await db.query(
      `
      UPDATE report_access_requests
      SET status = 'approved',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'pending'
      RETURNING *;
      `,
      [reviewerId, id],
    );
    return result.rows[0] || null;
  },

  async reject(id, reviewerId) {
    const result = await db.query(
      `
      UPDATE report_access_requests
      SET status = 'rejected',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'pending'
      RETURNING *;
      `,
      [reviewerId, id],
    );
    return result.rows[0] || null;
  },

  async hasApprovedAccess(reportId, requesterDepartmentId) {
    const result = await db.query(
      `
      SELECT 1
      FROM report_access_requests
      WHERE report_id = $1
        AND requester_department_id = $2
        AND status = 'approved'
      LIMIT 1
      `,
      [reportId, requesterDepartmentId],
    );
    return result.rowCount > 0;
  },
};

module.exports = reportAccessRequestModel;
