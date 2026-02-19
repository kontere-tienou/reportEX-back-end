const db = require("../config/database");

/**
 * ==========================================
 * REPORT CONTROLLER (MVC)
 * ==========================================
 */

const reportController = {
  /* ===============================
     1️⃣ GET TEMPLATES BY DEPARTMENT
  =============================== */
  async getTemplates(req, res) {
    try {
      const { departmentId } = req.params;

      const result = await db.query(
        `SELECT id, name, frequency, fields
         FROM report_templates
         WHERE department_id = $1 AND is_active = true
         ORDER BY created_at DESC`,
        [departmentId],
      );

      return res.json({
        success: true,
        templates: result.rows,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Erreur récupération templates" });
    }
  },

  /* ===============================
     2️⃣ CREATE REPORT
  =============================== */
  async createReport(req, res) {
    try {
      const { template_id, period_start, period_end, data } = req.body;

      const templateCheck = await db.query(
        `SELECT * FROM report_templates WHERE id = $1 AND is_active = true`,
        [template_id],
      );

      if (templateCheck.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Template non trouvé" });
      }

      const report = await db.query(
        `INSERT INTO reports
         (template_id, user_id, department_id, period_start, period_end, data, status)
         VALUES ($1,$2,$3,$4,$5,$6,'brouillon')
         RETURNING *`,
        [
          template_id,
          req.user.id,
          req.user.department_id,
          period_start,
          period_end,
          data,
        ],
      );

      return res.status(201).json({
        success: true,
        message: "Rapport créé",
        report: report.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Erreur création rapport" });
    }
  },

  /* ===============================
     3️⃣ UPDATE REPORT (Draft only)
  =============================== */
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const { data } = req.body;

      const check = await db.query(
        `SELECT * FROM reports WHERE id = $1 AND user_id = $2`,
        [id, req.user.id],
      );

      if (check.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Rapport non trouvé" });
      }

      if (
        check.rows[0].status !== "brouillon" &&
        check.rows[0].status !== "rejete"
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Impossible de modifier ce rapport",
          });
      }

      const updated = await db.query(
        `UPDATE reports
         SET data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [data, id],
      );

      return res.json({
        success: true,
        message: "Rapport mis à jour",
        report: updated.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     4️⃣ SUBMIT REPORT
  =============================== */
  async submitReport(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE reports
         SET status = 'soumis',
             submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         AND user_id = $2
         AND status IN ('brouillon','rejete')
         RETURNING *`,
        [id, req.user.id],
      );

      if (result.rowCount === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Rapport non soumis" });
      }

      return res.json({
        success: true,
        message: "Rapport soumis",
        report: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     5️⃣ VALIDATE REPORT (Direction/Admin)
  =============================== */
  async validateReport(req, res) {
    try {
      const { id } = req.params;
      const { status, comments } = req.body;

      if (!["valide", "rejete"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Statut invalide" });
      }

      const result = await db.query(
        `UPDATE reports
         SET status = $1,
             validated_by = $2,
             validated_at = CURRENT_TIMESTAMP,
             rejection_reason = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status = 'soumis'
         RETURNING *`,
        [status, req.user.id, comments, id],
      );

      if (result.rowCount === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Rapport déjà traité" });
      }

      await db.query(
        `INSERT INTO validations (report_id, validator_id, status, comments)
         VALUES ($1,$2,$3,$4)`,
        [id, req.user.id, status, comments],
      );

      return res.json({
        success: true,
        message: `Rapport ${status}`,
        report: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     6️⃣ GET MY REPORTS
  =============================== */
  async getMyReports(req, res) {
    try {
      const { status } = req.query;

      let query = `
        SELECT r.*, t.name AS template_name
        FROM reports r
        JOIN report_templates t ON r.template_id = t.id
        WHERE r.user_id = $1
      `;

      const params = [req.user.id];

      if (status) {
        query += ` AND r.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY r.created_at DESC`;

      const result = await db.query(query, params);

      return res.json({ success: true, reports: result.rows });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     7️⃣ GET REPORT DETAILS
  =============================== */
  async getReport(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT r.*, t.name AS template_name,
                u.full_name AS author_name,
                d.name AS department_name
         FROM reports r
         JOIN report_templates t ON r.template_id = t.id
         JOIN users u ON r.user_id = u.id
         JOIN departments d ON r.department_id = d.id
         WHERE r.id = $1`,
        [id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false });
      }
      
      if (report.department_id !== req.user.department_id) {
        const hasAccess = await reportAccessRequestModel.hasApprovedAccess(
          report.id,
          req.user.department_id,
        );

        if (
          !hasAccess &&
          req.user.role !== "direction" &&
          req.user.role !== "admin"
        ) {
          return res
            .status(403)
            .json({ success: false, message: "Accès refusé" });
        }
      }     

      return res.json({ success: true, report: result.rows[0] });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     8️⃣ DELETE REPORT (Draft Only)
  =============================== */
  async deleteReport(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `DELETE FROM reports
         WHERE id = $1
         AND user_id = $2
         AND status = 'brouillon'
         RETURNING *`,
        [id, req.user.id],
      );

      if (result.rowCount === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Suppression impossible" });
      }

      return res.json({ success: true, message: "Rapport supprimé" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },

  /* ===============================
     9️⃣ DEPARTMENT STATS
  =============================== */
  async getDepartmentStats(req, res) {
    try {
      const { departmentId } = req.params;

      const result = await db.query(
        `SELECT 
          COUNT(*) AS total,
          COUNT(CASE WHEN status = 'valide' THEN 1 END) AS validated,
          COUNT(CASE WHEN status = 'soumis' THEN 1 END) AS pending,
          COUNT(CASE WHEN status = 'rejete' THEN 1 END) AS rejected,
          COUNT(CASE WHEN status = 'brouillon' THEN 1 END) AS drafts
         FROM reports
         WHERE department_id = $1`,
        [departmentId],
      );

      return res.json({ success: true, stats: result.rows[0] });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },
};

module.exports = reportController;
