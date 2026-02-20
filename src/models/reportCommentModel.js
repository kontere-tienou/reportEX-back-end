const db = require("../config/database");

const reportCommentModel = {
  async create({ reportId, userId, comment }) {
    const result = await db.query(
      `
      INSERT INTO report_comments (report_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING *;
      `,
      [reportId, userId, comment],
    );

    return result.rows[0];
  },

  async findByReport(reportId) {
    const result = await db.query(
      `
      SELECT rc.*,
             u.full_name,
             u.role,
             d.name AS department_name
      FROM report_comments rc
      JOIN users u ON u.id = rc.user_id
      JOIN departments d ON d.id = u.department_id
      WHERE rc.report_id = $1
      ORDER BY rc.created_at ASC;
      `,
      [reportId],
    );

    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT * FROM report_comments WHERE id = $1`,
      [id],
    );

    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await db.query(
      `DELETE FROM report_comments WHERE id = $1 RETURNING *`,
      [id],
    );

    return result.rows[0] || null;
  },
};

module.exports = reportCommentModel;
