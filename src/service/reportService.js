// /services/reportService.js
const db = require("../config/database");
const { REPORT_STATUS, AUDIT_ACTIONS } = require("../config/constants");
const { isValidPeriod } = require("../middleware/errorHandler");
const logger = require("../config/logger");
const { sendReportSubmittedEmail } = require("./emailService");
const {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} = require("../middleware/errorHandler");

const reportService = {
 
  async createReport(userId, departmentId, reportData) {
    const {
      template_id,
      period_start,
      period_end,
      data,
      visibility = "private", // private | public
    } = reportData;

    // Vérifier que le template existe + actif
    const templateResult = await db.query(
      "SELECT * FROM report_templates WHERE id = $1 AND is_active = true",
      [template_id],
    );

    if (templateResult.rows.length === 0) {
      throw new NotFoundError("Template de rapport non trouvé");
    }

    const template = templateResult.rows[0];

    // Vérifier que le template appartient au bon département
    if (template.department_id !== departmentId) {
      throw new ForbiddenError(
        "Ce template n'appartient pas à votre département",
      );
    }

    // Valider visibilité
    if (!["private", "public"].includes(visibility)) {
      throw new ValidationError(
        "Visibility invalide. Valeurs possibles: 'private' | 'public'",
      );
    }

    // Valider la période
    const periodValidation = isValidPeriod(period_start, period_end);
    if (!periodValidation.valid) {
      throw new ValidationError(periodValidation.error);
    }

    // Vérifier qu'il n'existe pas déjà un rapport pour cette période (sauf rejete)
    const existingReport = await db.query(
      `SELECT id FROM reports
       WHERE template_id = $1
         AND user_id = $2
         AND period_start = $3
         AND period_end = $4
         AND status != $5`,
      [template_id, userId, period_start, period_end, REPORT_STATUS.REJECTED],
    );

    if (existingReport.rows.length > 0) {
      throw new ConflictError("Un rapport existe déjà pour cette période");
    }

    // Valider data vs template.fields
    this.validateReportData(data, template.fields);

    // Transaction: insert report + audit log
    await db.query("BEGIN");
    try {
      const result = await db.query(
        `INSERT INTO reports
         (template_id, user_id, department_id, period_start, period_end, data, status, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          template_id,
          userId,
          departmentId,
          period_start,
          period_end,
          data, // JSONB: pas besoin de stringify en pg
          REPORT_STATUS.DRAFT,
          visibility,
        ],
      );

      const report = result.rows[0];

      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          userId,
          AUDIT_ACTIONS.CREATE_REPORT,
          "report",
          report.id,
          { template_id },
        ],
      );

      await db.query("COMMIT");

      logger.info(`Report created: ID ${report.id} by user ${userId}`);
      return report;
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  },

  async createReport(user, payload) {
    const {
      template_id,
      period_start,
      period_end,
      data,
      visibility = "private",
    } = payload;

    const template = await db.query(
      `SELECT * FROM report_templates WHERE id=$1 AND is_active=true`,
      [template_id],
    );

    if (!template.rows.length) throw new NotFoundError("Template introuvable");

    if (template.rows[0].department_id !== user.department_id)
      throw new ForbiddenError("Template d'un autre département");

    const result = await db.query(
      `INSERT INTO reports
       (template_id,user_id,department_id,period_start,period_end,data,status,visibility)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        template_id,
        user.id,
        user.department_id,
        period_start,
        period_end,
        data,
        REPORT_STATUS.DRAFT,
        visibility,
      ],
    );

    return result.rows[0];
  },
  async getAllReports(filters, user) {
    try {
      let query = `
            SELECT 
                r.*,
                d.name as department_name,
                u.full_name as author_name,
                u.email as author_email
            FROM reports r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;

      const params = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.status) {
        query += ` AND r.status = $${paramIndex++}`;
        params.push(filters.status);
      }

      if (filters.visibility) {
        query += ` AND r.visibility = $${paramIndex++}`;
        params.push(filters.visibility);
      }

      if (filters.department_id) {
        query += ` AND r.department_id = $${paramIndex++}`;
        params.push(filters.department_id);
      }

      if (filters.search) {
        query += ` AND (
                r.id::text LIKE $${paramIndex} 
                OR u.full_name ILIKE $${paramIndex}
                OR d.name ILIKE $${paramIndex}
            )`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Add ordering
      query += ` ORDER BY r.created_at DESC`;

      // Add pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const offset = (page - 1) * limit;

      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      return result.rows;
    } catch (error) {
      console.error("Error in getAllReports:", error);
      throw error;
    }
  },

  async getReportById(user, reportId) {
    const result = await db.query(`SELECT * FROM reports WHERE id=$1`, [
      reportId,
    ]);

    if (!result.rows.length) throw new NotFound("Rapport introuvable");

    const report = result.rows[0];

    if (
      user.role !== "direction" &&
      user.role !== "admin" &&
      report.department_id !== user.department_id
    ) {
      throw new ForbiddenError("Accès interdit");
    }

    return report;
  },

  async updateReport(user, reportId, payload) {
    const report = await this.getReportById(user, reportId);

    if (report.is_locked) throw new ConflictError("Rapport verrouillé");

    if (
      report.status !== REPORT_STATUS.DRAFT &&
      report.status !== REPORT_STATUS.REJECTED
    )
      throw new ConflictError("Rapport non modifiable");

    if (report.user_id !== user.id) throw new ForbiddenError("Non autorisé");

    const result = await db.query(
      `UPDATE reports
       SET data=$1,
           visibility=$2,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$3
       RETURNING *`,
      [
        payload.data || report.data,
        payload.visibility || report.visibility,
        reportId,
      ],
    );

    return result.rows[0];
  },

  async deleteReport(user, reportId) {
    const report = await this.getReportById(user, reportId);

    if (report.status !== REPORT_STATUS.DRAFT)
      throw new ConflictError("Seuls les brouillons peuvent être supprimés");

    if (report.user_id !== user.id) throw new ForbiddenError("Non autorisé");

    await db.query(`DELETE FROM reports WHERE id=$1`, [reportId]);

    return { message: "Rapport supprimé" };
  },

  async submitReport(reportId, userId) {
    // On lock la ligne pour éviter double submit
    const reportResult = await db.query(
      `SELECT * FROM reports WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reportId, userId],
    );

    if (reportResult.rows.length === 0) {
      throw new NotFoundError("Rapport non trouvé");
    }

    const report = reportResult.rows[0];

    // Vérifier statut éligible
    const allowed = [
      REPORT_STATUS.DRAFT,
      REPORT_STATUS.REJECTED,
      REPORT_STATUS.IN_REVISION,
    ];
    if (!allowed.includes(report.status)) {
      throw new ConflictError("Ce rapport ne peut pas être soumis");
    }

    // Si report verrouillé, on refuse
    if (report.is_locked) {
      throw new ConflictError(
        "Ce rapport est verrouillé et ne peut pas être soumis",
      );
    }

    await db.query("BEGIN");
    try {
      // Mettre à jour le statut -> soumis
      const updated = await db.query(
        `UPDATE reports
         SET status = $1,
             submitted_at = CURRENT_TIMESTAMP,
             rejection_reason = NULL,
             validated_at = NULL,
             validated_by = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [REPORT_STATUS.SUBMITTED, reportId],
      );

      // Audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
         VALUES ($1,$2,$3,$4)`,
        [userId, AUDIT_ACTIONS.SUBMIT_REPORT, "report", reportId],
      );

      // Récupérer les validateurs (schema final: direction + admin)
      const validators = await db.query(
        `SELECT id, email, full_name
         FROM users
         WHERE role IN ('direction','admin')
           AND is_active = true`,
      );

      // Notifications
      if (validators.rows.length > 0) {
        const notificationValues = validators.rows
          .map(
            (_, index) =>
              `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`,
          )
          .join(",");

        const notificationParams = validators.rows.flatMap((v) => [
          v.id,
          "validation",
          "Nouveau rapport à valider",
          `Un rapport a été soumis et nécessite votre validation (ID: ${reportId})`,
        ]);

        await db.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ${notificationValues}`,
          notificationParams,
        );
      }

      await db.query("COMMIT");

      // Email : hors transaction (ne pas bloquer DB si email fail)
      try {
        if (validators.rows.length > 0) {
          const reportWithDetails = await this.getReportDetails(reportId);
          await sendReportSubmittedEmail(validators.rows, reportWithDetails);
        }
      } catch (emailErr) {
        logger.warn(
          `Email send failed for submitted report ${reportId}: ${emailErr.message}`,
        );
      }

      logger.info(`Report submitted: ID ${reportId}`);
      return updated.rows[0];
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  },

  async validateReport(reportId, validatorUser) {
    if (!["direction", "admin", "validateur"].includes(validatorUser.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    await db.query("BEGIN");
    try {
      const reportRes = await db.query(
        `SELECT * FROM reports WHERE id = $1 FOR UPDATE`,
        [reportId],
      );
      if (reportRes.rows.length === 0)
        throw new NotFoundError("Rapport non trouvé");

      const report = reportRes.rows[0];

      if (report.status !== REPORT_STATUS.SUBMITTED) {
        throw new ConflictError(
          "Seuls les rapports soumis peuvent être validés",
        );
      }

      const updated = await db.query(
        `UPDATE reports
         SET status = $1,
             validated_at = CURRENT_TIMESTAMP,
             validated_by = $2,
             is_locked = true,
             rejection_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [REPORT_STATUS.VALIDATED, validatorUser.id, reportId],
      );

      // Historique validation
      await db.query(
        `INSERT INTO validations (report_id, validator_id, status, comments)
         VALUES ($1,$2,$3,$4)`,
        [reportId, validatorUser.id, "approuve", null],
      );

      // Audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
         VALUES ($1,$2,$3,$4)`,
        [validatorUser.id, AUDIT_ACTIONS.VALIDATE_REPORT, "report", reportId],
      );

      // Notification auteur
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          report.user_id,
          "validation",
          "Rapport validé",
          `Votre rapport (ID: ${reportId}) a été validé.`,
          `/reports/${reportId}`,
        ],
      );

      await db.query("COMMIT");
      return updated.rows[0];
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  },

  async rejectReport(reportId, validatorUser, reason) {
    if (!reason || String(reason).trim().length < 3) {
      throw new ValidationError("La raison du rejet est obligatoire");
    }
    if (!["direction", "admin", "validateur"].includes(validatorUser.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    await db.query("BEGIN");
    try {
      const reportRes = await db.query(
        `SELECT * FROM reports WHERE id = $1 FOR UPDATE`,
        [reportId],
      );
      if (reportRes.rows.length === 0)
        throw new NotFoundError("Rapport non trouvé");

      const report = reportRes.rows[0];

      if (report.status !== REPORT_STATUS.SUBMITTED) {
        throw new ConflictError(
          "Seuls les rapports soumis peuvent être rejetés",
        );
      }

      const updated = await db.query(
        `UPDATE reports
         SET status = $1,
             validated_at = CURRENT_TIMESTAMP,
             validated_by = $2,
             rejection_reason = $3,
             is_locked = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [REPORT_STATUS.REJECTED, validatorUser.id, reason, reportId],
      );

      await db.query(
        `INSERT INTO validations (report_id, validator_id, status, comments)
         VALUES ($1,$2,$3,$4)`,
        [reportId, validatorUser.id, "rejete", reason],
      );

      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          validatorUser.id,
          AUDIT_ACTIONS.REJECT_REPORT,
          "report",
          reportId,
          { reason },
        ],
      );

      // Notifier auteur
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          report.user_id,
          "validation",
          "Rapport rejeté",
          `Votre rapport (ID: ${reportId}) a été rejeté. Raison: ${reason}`,
          `/reports/${reportId}`,
        ],
      );

      await db.query("COMMIT");
      return updated.rows[0];
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  },

  validateReportData(data, templateFields) {
    const fields =
      typeof templateFields === "string"
        ? JSON.parse(templateFields)
        : templateFields;

    const errors = [];

    fields.forEach((field) => {
      const value = data?.[field.id];

      // required: accepter 0 / false
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "");

      if (field.required && isEmpty) {
        errors.push(`Le champ "${field.label}" est obligatoire`);
        return;
      }

      if (!isEmpty) {
        if (field.type === "number" && isNaN(Number(value))) {
          errors.push(`Le champ "${field.label}" doit être un nombre`);
        }
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }

    return true;
  },

  async getReportDetails(id) {
    try {
      const query = `
            SELECT 
                r.*,
                d.name as department_name,
                u.full_name as author_name,
                u.email as author_email,
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', c.id,
                        'content', c.comment,
                        'created_at', c.created_at,
                        'user_id', c.user_id,
                        'user_name', cu.full_name
                    )
                ) FILTER (WHERE c.id IS NOT NULL) as comments,
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', rr.user_id,
                        'user_name', ru.full_name,
                        'read_at', rr.read_at
                    )
                ) FILTER (WHERE rr.user_id IS NOT NULL) as readers
            FROM reports r
            LEFT JOIN departments d ON r.department_id = d.id
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN comments c ON r.id = c.report_id
            LEFT JOIN users cu ON c.user_id = cu.id
            LEFT JOIN report_readers rr ON r.id = rr.report_id
            LEFT JOIN users ru ON rr.user_id = ru.id
            WHERE r.id = $1
            GROUP BY r.id, d.name, u.full_name, u.email
        `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        const error = new Error("Report not found");
        error.name = "NotFoundError";
        throw error;
      }

      return result.rows[0];
    } catch (error) {
      console.error("Error in getReportDetails:", error);
      throw error;
    }
  },

  async requestAccess(user, reportId) {
    const report = await db.query(`SELECT * FROM reports WHERE id=$1`, [
      reportId,
    ]);

    if (!report.rows.length) throw new NotFoundError("Rapport introuvable");

    const targetReport = report.rows[0];

    if (targetReport.department_id === user.department_id)
      throw new ConflictError("Votre département possède déjà ce rapport");

    if (targetReport.visibility !== "public")
      throw new ForbiddenError("Ce rapport est privé");

    const existing = await db.query(
      `SELECT id FROM report_access_requests
      WHERE report_id=$1
      AND requesting_department_id=$2
      AND status='pending'`,
      [reportId, user.department_id],
    );

    if (existing.rows.length)
      throw new ConflictError("Demande déjà en attente");

    const result = await db.query(
      `INSERT INTO report_access_requests
      (report_id, requesting_department_id)
      VALUES($1,$2)
      RETURNING *`,
      [reportId, user.department_id],
    );

    return result.rows[0];
  },

  async approveRequest(user, requestId) {
    if (!["direction", "admin"].includes(user.role))
      throw new ForbiddenError("Accès refusé");

    const request = await db.query(
      `SELECT * FROM report_access_requests WHERE id=$1`,
      [requestId],
    );

    if (!request.rows.length) throw new NotFoundError("Demande introuvable");

    const result = await db.query(
      `UPDATE report_access_requests
      SET status='approved',
          reviewed_by=$1,
          reviewed_at=CURRENT_TIMESTAMP
      WHERE id=$2
      RETURNING *`,
      [user.id, requestId],
    );

    return result.rows[0];
  },

  async rejectRequest(user, requestId) {
    if (!["direction", "admin"].includes(user.role))
      throw new ForbiddenError("Accès refusé");

    const request = await db.query(
      `SELECT * FROM report_access_requests WHERE id=$1`,
      [requestId],
    );

    if (!request.rows.length) throw new NotFoundError("Demande introuvable");

    const result = await db.query(
      `UPDATE report_access_requests
      SET status='rejected',
          reviewed_by=$1,
          reviewed_at=CURRENT_TIMESTAMP
      WHERE id=$2
      RETURNING *`,
      [user.id, requestId],
    );

    return result.rows[0];
  },

  async canAccessReport(user, reportId) {
    if (user.role === "direction" || user.role === "admin") return true;

    const report = await db.query(`SELECT * FROM reports WHERE id=$1`, [
      reportId,
    ]);

    if (!report.rows.length) return false;

    const r = report.rows[0];

    if (r.department_id === user.department_id) return true;

    if (r.visibility !== "public") return false;

    const access = await db.query(
      `SELECT id FROM report_access_requests
      WHERE report_id=$1
      AND requesting_department_id=$2
      AND status='approved'`,
      [reportId, user.department_id],
    );

    return access.rows.length > 0;
  },

  async calculateDepartmentStats(
    departmentId,
    startDate = null,
    endDate = null,
  ) {
    let query = `
      SELECT
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated_reports,
        COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN status = 'rejete' THEN 1 END) as rejected_reports,
        COUNT(CASE WHEN status = 'brouillon' THEN 1 END) as draft_reports,
        COUNT(CASE WHEN status = 'en_revision' THEN 1 END) as revision_reports,
        AVG(CASE
          WHEN status = 'valide' AND submitted_at IS NOT NULL AND validated_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (validated_at - submitted_at))/3600
        END) as avg_validation_time_hours
      FROM reports
      WHERE department_id = $1
    `;

    const params = [departmentId];

    if (startDate && endDate) {
      query += ` AND period_start >= $2 AND period_end <= $3`;
      params.push(startDate, endDate);
    }

    const result = await db.query(query, params);
    const stats = result.rows[0];

    const total = parseInt(stats.total_reports, 10) || 0;
    const validated = parseInt(stats.validated_reports, 10) || 0;
    const rejected = parseInt(stats.rejected_reports, 10) || 0;

    return {
      ...stats,
      validation_rate:
        total > 0 ? ((validated / total) * 100).toFixed(2) : "0.00",
      rejection_rate:
        total > 0 ? ((rejected / total) * 100).toFixed(2) : "0.00",
      avg_validation_time_hours: parseFloat(
        stats.avg_validation_time_hours || 0,
      ).toFixed(2),
    };
  },
};

module.exports = reportService;
