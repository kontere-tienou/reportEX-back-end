const db = require("../config/database");

const reportAccessRequestModel = {
  async create({ reportId, requesterId, reason }) {
    const result = await db.query(
      `
      INSERT INTO report_access_requests
        (report_id, requester_id, reason, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
      `,
      [reportId, requesterId, reason || null],
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `
      SELECT rar.*,
             u.full_name AS requester_name,
             u.email AS requester_email,
             u.department_id AS requester_department_id
      FROM report_access_requests rar
      LEFT JOIN users u ON u.id = rar.requester_id
      WHERE rar.id = $1
      `,
      [id],
    );
    return result.rows[0] || null;
  },

  // ✅ Vérifie s'il existe déjà une demande EN ATTENTE pour ce rapport par un user du même département
  async findPendingByReportAndDept(reportId, requesterDepartmentId) {
    const result = await db.query(
      `
      SELECT rar.*
      FROM report_access_requests rar
      JOIN users u ON u.id = rar.requester_id
      WHERE rar.report_id = $1
        AND u.department_id = $2
        AND rar.status = 'pending'
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
             u.full_name AS requester_name,
             u.email AS requester_email,
             u.department_id AS requester_department_id,
             d.name AS requester_department_name,
             r.department_id AS report_department_id,
             rd.name AS report_department_name,
             r.period_start,
             r.period_end,
             r.status AS report_status
      FROM report_access_requests rar
      JOIN users u ON u.id = rar.requester_id
      LEFT JOIN departments d ON d.id = u.department_id
      JOIN reports r ON r.id = rar.report_id
      LEFT JOIN departments rd ON rd.id = r.department_id
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
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'pending'
      RETURNING *;
      `,
      [reviewerId, id],
    );
    return result.rows[0] || null;
  },

  async reject(id, reviewerId, rejectionReason = null) {
    const result = await db.query(
      `
      UPDATE report_access_requests
      SET status = 'rejected',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending'
      RETURNING *;
      `,
      [reviewerId, rejectionReason, id],
    );
    return result.rows[0] || null;
  },

  // ✅ Accès approuvé pour un USER (pas un département)
  async hasApprovedAccess(reportId, requesterId) {
    const result = await db.query(
      `
      SELECT 1
      FROM report_access_requests
      WHERE report_id = $1
        AND requester_id = $2
        AND status = 'approved'
      LIMIT 1
      `,
      [reportId, requesterId],
    );
    return result.rowCount > 0;
  },

  // optionnel utile : éviter doublon user
  async findPendingByReportAndUser(reportId, requesterId) {
    const result = await db.query(
      `
      SELECT *
      FROM report_access_requests
      WHERE report_id = $1
        AND requester_id = $2
        AND status = 'pending'
      LIMIT 1
      `,
      [reportId, requesterId],
    );
    return result.rows[0] || null;
  },
};

module.exports = reportAccessRequestModel;
