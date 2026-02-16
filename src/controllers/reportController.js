const db = require('../config/database');

const reportController = {
  // Récupérer les templates de rapports pour un département
  async getTemplates(req, res) {
    try {
      const { departmentId } = req.params;

      const result = await db.query(
        `SELECT id, name, frequency, fields, is_active
         FROM report_templates
         WHERE department_id = $1 AND is_active = true
         ORDER BY frequency`,
        [departmentId],
      );

      res.json({
        success: true,
        templates: result.rows,
      });
    } catch (error) {
      console.error("Erreur récupération templates:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des templates",
      });
    }
  },
  // Créer un nouveau rapport
  async createReport(req, res) {
    try {
      const { template_id, period_start, period_end, data } = req.body;

      // Vérifier que le template existe
      const templateResult = await db.query(
        "SELECT * FROM report_templates WHERE id = $1",
        [template_id],
      );

      if (templateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Template non trouvé",
        });
      }

      // Créer le rapport
      const result = await db.query(
        `INSERT INTO reports 
         (template_id, user_id, department_id, period_start, period_end, data, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          template_id,
          req.user.id,
          req.user.department_id,
          period_start,
          period_end,
          JSON.stringify(data),
          "brouillon",
        ],
      );

      // Log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          "CREATE_REPORT",
          "report",
          result.rows[0].id,
          JSON.stringify({ template_id }),
        ],
      );

      res.status(201).json({
        success: true,
        message: "Rapport créé avec succès",
        report: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur création rapport:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du rapport",
      });
    }
  },
  // Mettre à jour un rapport
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const { data } = req.body;

      // Vérifier que le rapport existe et appartient à l'utilisateur
      const checkResult = await db.query(
        "SELECT * FROM reports WHERE id = $1 AND user_id = $2",
        [id, req.user.id],
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Rapport non trouvé",
        });
      }

      // Vérifier que le rapport n'est pas déjà validé
      if (checkResult.rows[0].status === "valide") {
        return res.status(400).json({
          success: false,
          message: "Impossible de modifier un rapport validé",
        });
      }

      // Mettre à jour
      const result = await db.query(
        `UPDATE reports 
         SET data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(data), id],
      );

      res.json({
        success: true,
        message: "Rapport mis à jour avec succès",
        report: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur mise à jour rapport:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour du rapport",
      });
    }
  },
  // Soumettre un rapport pour validation
  async submitReport(req, res) {
    try {
      const { id } = req.params;

      // Vérifier et mettre à jour
      const result = await db.query(
        `UPDATE reports 
         SET status = 'soumis', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status = 'brouillon'
         RETURNING *`,
        [id, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Rapport non trouvé ou déjà soumis",
        });
      }

      // Créer notification pour les validateurs
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         SELECT id, 'validation', 'Nouveau rapport à valider', 
                'Un rapport a été soumis et nécessite votre validation', 
                '/reports/${id}'
         FROM users WHERE role IN ('validateur', 'admin')`,
      );

      res.json({
        success: true,
        message: "Rapport soumis avec succès",
        report: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur soumission rapport:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la soumission du rapport",
      });
    }
  },
  // Récupérer les rapports de l'utilisateur
  async getMyReports(req, res) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      let query = `
        SELECT r.*, t.name as template_name, t.frequency,
               u.full_name as author_name,
               v.full_name as validator_name
        FROM reports r
        JOIN report_templates t ON r.template_id = t.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users v ON r.validated_by = v.id
        WHERE r.user_id = $1
      `;

      const params = [req.user.id];

      if (status) {
        query += ` AND r.status = $${params.length + 1}`;
        params.push(status);
      }

      query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      res.json({
        success: true,
        reports: result.rows,
        total: result.rowCount,
      });
    } catch (error) {
      console.error("Erreur récupération rapports:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des rapports",
      });
    }
  },
  // Récupérer un rapport spécifique
  async getReport(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT r.*, t.name as template_name, t.frequency, t.fields,
                u.full_name as author_name,
                v.full_name as validator_name,
                d.name as department_name
         FROM reports r
         JOIN report_templates t ON r.template_id = t.id
         JOIN users u ON r.user_id = u.id
         LEFT JOIN users v ON r.validated_by = v.id
         JOIN departments d ON r.department_id = d.id
         WHERE r.id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Rapport non trouvé",
        });
      }

      res.json({
        success: true,
        report: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur récupération rapport:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du rapport",
      });
    }
  },
  // Valider un rapport (pour validateurs)
  async validateReport(req, res) {
    try {
      const { id } = req.params;
      const { status, comments } = req.body; // status: 'valide' ou 'rejete'

      if (!["valide", "rejete"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Statut invalide",
        });
      }

      // Mettre à jour le rapport
      const result = await db.query(
        `UPDATE reports 
         SET status = $1, validated_at = CURRENT_TIMESTAMP, validated_by = $2,
             rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status = 'soumis'
         RETURNING *`,
        [status, req.user.id, comments, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Rapport non trouvé ou déjà traité",
        });
      }

      // Enregistrer la validation
      await db.query(
        `INSERT INTO validations (report_id, validator_id, status, comments)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.id, status, comments],
      );

      // Notifier l'auteur
      const report = result.rows[0];
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          report.user_id,
          "validation",
          status === "valide" ? "Rapport validé" : "Rapport rejeté",
          status === "valide"
            ? "Votre rapport a été validé"
            : `Votre rapport a été rejeté: ${comments || "Aucun commentaire"}`,
          `/reports/${id}`,
        ],
      );

      res.json({
        success: true,
        message: `Rapport ${status === "valide" ? "validé" : "rejeté"} avec succès`,
        report: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur validation rapport:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la validation du rapport",
      });
    }
  },
  // Récupérer les statistiques du département
  async getDepartmentStats(req, res) {
    try {
      const { departmentId } = req.params;
      const { startDate, endDate } = req.query;

      let query = `
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated_reports,
          COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'rejete' THEN 1 END) as rejected_reports,
          COUNT(CASE WHEN status = 'brouillon' THEN 1 END) as draft_reports
        FROM reports
        WHERE department_id = $1
      `;

      const params = [departmentId];

      if (startDate && endDate) {
        query += ` AND period_start >= $2 AND period_end <= $3`;
        params.push(startDate, endDate);
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        stats: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur statistiques:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des statistiques",
      });
    }
  },

  async bulkSubmitReports(req, res) {
    const { reportIds } = req.body;

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No report IDs provided." });
    }

    try {
      // Update multiple reports to 'submitted' status
      const result = await db.query(
        `UPDATE reports SET status = 'soumis', submitted_at = CURRENT_TIMESTAMP WHERE id = ANY($1::int[]) RETURNING *`,
        [reportIds],
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No reports found to submit." });
      }

      // Send notifications to validators (email or in-app)
      await sendReportSubmittedEmail(result.rows, "mensuel");

      res
        .status(200)
        .json({
          success: true,
          message: "Reports submitted successfully",
          reports: result.rows,
        });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error submitting reports" });
    }
    },
  
  // delete a report (for drafts only)
  async deleteReport(req, res) {
    const { id } = req.params;

    try {
      const result = await db.query(
        "DELETE FROM reports WHERE id = $1 AND user_id = $2 RETURNING *",
        [id, req.user.id],
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({
            success: false,
            message: "Report not found or user not authorized.",
          });
      }

      res
        .status(200)
        .json({ success: true, message: "Report deleted successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error deleting report" });
    }
    },
  // In exportService.js
async generateBatchPDFReports(reports) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const fileName = `reports_batch_${Date.now()}.pdf`;
      const exportDir = path.join(__dirname, "../../exports");
      const filePath = path.join(exportDir, fileName);

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      reports.forEach((report) => {
        doc.addPage()
          .fontSize(24)
          .text(`Report for ${report.template_name}`, { align: 'center' })
          .moveDown();
        doc.fontSize(12).text(`Date: ${formatDateFR(report.created_at)}`);
        doc.text(`Status: ${report.status}`);
        doc.text(`Department: ${report.department_name}`);
        doc.text(`Author: ${report.author_name}`);
        doc.text(`Data: ${JSON.stringify(report.data)}`);
      });

      doc.end();

      stream.on("finish", () => {
        logger.info(`PDF batch generated: ${fileName}`);
        resolve({ filePath, fileName });
      });

      stream.on("error", (error) => {
        logger.error("Error generating batch PDF:", error);
        reject(error);
      });
    } catch (error) {
      logger.error("Error generating batch PDF:", error);
      reject(error);
    }
  });
}

};

module.exports = reportController;