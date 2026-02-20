const db = require("../config/database");
const { getReportDetails } = require("../service/reportService");
const reportAccessRequestService = require("../service/reportAccessRequestService");

/**
 * ==========================================
 * REPORT CONTROLLER (MVC)
 * ==========================================
 */

const reportController = {
  /*  CREATE REPORT*/
  async createReport(req, res) {
    try {
      const { period_start, period_end, data, visibility } = req.body;

      /* VALIDATIONS BASIQUES */

      if (!period_start || !period_end) {
        return res.status(400).json({
          success: false,
          message: "Les dates de période sont obligatoires",
        });
      }

      if (!data || typeof data !== "object") {
        return res.status(400).json({
          success: false,
          message: "Les données du rapport sont invalides",
        });
      }

      // Validation période
      if (new Date(period_start) > new Date(period_end)) {
        return res.status(400).json({
          success: false,
          message: "La date de début doit être avant la date de fin",
        });
      }

      /* VERIFIER DOUBLON PERIODE */

      const existing = await db.query(
        `
        SELECT id FROM reports
        WHERE department_id = $1
        AND period_start = $2
        AND period_end = $3
        AND status != 'rejete'
        `,
        [req.user.department_id, period_start, period_end],
      );

      if (existing.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: "Un rapport existe déjà pour cette période",
        });
      }

      /* INSERT REPORT*/

      const result = await db.query(
        `
        INSERT INTO reports
        (user_id, department_id, period_start, period_end, data, visibility, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING *;
        `,
        [
          req.user.id,
          req.user.department_id,
          period_start,
          period_end,
          JSON.stringify(data),
          visibility || "private",
          "brouillon",
        ],
      );

      const report = result.rows[0];

      /* AUDIT LOG*/

      await db.query(
        `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          req.user.id,
          "CREATE_REPORT",
          "report",
          report.id,
          JSON.stringify({
            period_start,
            period_end,
            visibility,
          }),
        ],
      );

      /* NOTIFICATION DIRECTION*/

      const io = req.app.get("io");

      const directionUsers = await db.query(
        `
        SELECT id FROM users
        WHERE role IN ('direction','admin')
        AND is_active = true
        `,
      );

      for (const dir of directionUsers.rows) {
        await db.query(
          `
          INSERT INTO notifications (user_id, type, title, message, link)
          VALUES ($1,$2,$3,$4,$5)
          `,
          [
            dir.id,
            "report_created",
            "Nouveau rapport créé",
            `Un nouveau rapport a été créé par ${req.user.full_name}`,
            `/reports/${report.id}`,
          ],
        );

        // envoi de Socket realtime
        if (io) {
          io.to(`user:${dir.id}`).emit("notification", {
            type: "report_created",
            title: "Nouveau rapport",
            message: `Rapport créé par ${req.user.full_name}`,
            link: `/reports/${report.id}`,
          });
        }
      }

      /* RESPONSE*/

      return res.status(201).json({
        success: true,
        message: "Rapport créé avec succès",
        report,
      });
    } catch (error) {
      console.error("Erreur création rapport:", error);

      return res.status(500).json({
        success: false,
        message: "Erreur interne lors de la création du rapport",
      });
    }
  },
  /* UPDATE REPORT (Draft only)*/
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
        return res.status(400).json({
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
  /* SUBMIT REPORT */
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
  /* VALIDATE REPORT (Direction/Admin)*/
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
  async getAllReports(req, res) {
    try {
      const result = await db.query(`
        SELECT r.*, u.full_name, d.name as department_name
        FROM reports r
        JOIN users u ON r.user_id = u.id
        JOIN departments d ON r.department_id = d.id
        ORDER BY r.created_at DESC
      `);

      return res.json({
        success: true,
        reports: result.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },
  /*GET MY REPORTS*/
  async getMyReports(req, res) {
    try {
      const { status } = req.query;

      let query = `
        SELECT r.*, 
               u.full_name AS author_name,
               d.name AS department_name
        FROM reports r
        JOIN users u ON r.user_id = u.id
        JOIN departments d ON r.department_id = d.id
        WHERE r.user_id = $1
      `;

      const params = [req.user.id];

      if (status) {
        query += ` AND r.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY r.created_at DESC`;

      const result = await db.query(query, params);

      return res.json({
        success: true,
        reports: result.rows,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },
  /* GET REPORT DETAILS */
  async getReportDetails(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `
        SELECT r.*,
               u.full_name AS author_name,
               d.name AS department_name
        FROM reports r
        JOIN users u ON r.user_id = u.id
        JOIN departments d ON r.department_id = d.id
        WHERE r.id = $1
        `,
        [id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false });
      }

      const report = result.rows[0];

      // 🔐 Vérification accès
      const canRead = await reportAccessRequestService.canReadReport({
        reportId: parseInt(id, 10),
        user: req.user,
      });

      if (!canRead) {
        return res.status(403).json({
          success: false,
          message: "Accès refusé",
        });
      }

      return res.json({
        success: true,
        report,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }
  },
  /* DELETE REPORT (Draft Only)*/
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
  /* DEPARTMENT STATS*/
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
