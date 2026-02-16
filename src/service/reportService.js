const db = require('../config/database');
const { REPORT_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { isValidPeriod } = require('../utils/dateHelpers');
const logger = require('../config/logger');
const {sendReportSubmittedEmail} = require("./emailService");
const {ConflictError, NotFoundError} = require("../utils/errorHandler");

const reportService = {
    /**
     * Créer un nouveau rapport avec validation
     */
    async createReport(userId, departmentId, reportData) {
        const { template_id, period_start, period_end, data } = reportData;

        // Vérifier que le template existe
        const templateResult = await db.query(
            'SELECT * FROM report_templates WHERE id = $1 AND is_active = true',
            [template_id]
        );

        if (templateResult.rows.length === 0) {
            throw new NotFoundError('Template de rapport non trouvé');
        }

        const template = templateResult.rows[0];

        // Vérifier que le template appartient au bon département
        if (template.department_id !== departmentId) {
            throw new ValidationError('Ce template n\'appartient pas à votre département');
        }

        // Valider la période
        const periodValidation = isValidPeriod(period_start, period_end);
        if (!periodValidation.valid) {
            throw new ValidationError(periodValidation.error);
        }

        // Vérifier qu'il n'existe pas déjà un rapport pour cette période
        const existingReport = await db.query(
            `SELECT id FROM reports 
       WHERE template_id = $1 
       AND user_id = $2 
       AND period_start = $3 
       AND period_end = $4
       AND status != 'rejete'`,
            [template_id, userId, period_start, period_end]
        );

        if (existingReport.rows.length > 0) {
            throw new ConflictError('Un rapport existe déjà pour cette période');
        }

        // Valider les données par rapport au template
        this.validateReportData(data, template.fields);

        // Créer le rapport
        const result = await db.query(
            `INSERT INTO reports 
       (template_id, user_id, department_id, period_start, period_end, data, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [template_id, userId, departmentId, period_start, period_end, JSON.stringify(data), REPORT_STATUS.DRAFT]
        );

        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
            [userId, AUDIT_ACTIONS.CREATE_REPORT, 'report', result.rows[0].id, JSON.stringify({ template_id })]
        );

        logger.info(`Report created: ID ${result.rows[0].id} by user ${userId}`);

        return result.rows[0];
    },

    /**
     * Soumettre un rapport pour validation
     */
    async submitReport(reportId, userId) {
        // Vérifier que le rapport existe et appartient à l'utilisateur
        const reportResult = await db.query(
            'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
            [reportId, userId]
        );

        if (reportResult.rows.length === 0) {
            throw new NotFoundError('Rapport non trouvé');
        }

        const report = reportResult.rows[0];

        // Vérifier le statut
        if (report.status !== REPORT_STATUS.DRAFT && report.status !== REPORT_STATUS.REJECTED) {
            throw new ConflictError('Ce rapport ne peut pas être soumis');
        }

        // Mettre à jour le statut
        const result = await db.query(
            `UPDATE reports 
       SET status = $1, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
            [REPORT_STATUS.SUBMITTED, reportId]
        );

        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
            [userId, AUDIT_ACTIONS.SUBMIT_REPORT, 'report', reportId]
        );

        // Récupérer les validateurs
        const validators = await db.query(
            `SELECT id, email, full_name 
       FROM users 
       WHERE role IN ('validateur', 'admin') 
       AND is_active = true`
        );

        // Créer des notifications pour les validateurs
        if (validators.rows.length > 0) {
            const notificationValues = validators.rows.map((v, index) =>
                `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
            ).join(',');

            const notificationParams = validators.rows.flatMap(v => [
                v.id,
                'validation',
                'Nouveau rapport à valider',
                `Un rapport a été soumis et nécessite votre validation (ID: ${reportId})`
            ]);

            await db.query(
                `INSERT INTO notifications (user_id, type, title, message)
         VALUES ${notificationValues}`,
                notificationParams
            );

            // Envoyer des emails aux validateurs
            const reportWithDetails = await this.getReportDetails(reportId);
            await sendReportSubmittedEmail(validators.rows, reportWithDetails);
        }

        logger.info(`Report submitted: ID ${reportId}`);

        return result.rows[0];
    },

    /**
     * Valider les données du rapport par rapport au template
     */
    validateReportData(data, templateFields) {
        const fields = typeof templateFields === 'string'
            ? JSON.parse(templateFields)
            : templateFields;

        const errors = [];

        fields.forEach(field => {
            if (field.required && !data[field.id]) {
                errors.push(`Le champ "${field.label}" est obligatoire`);
            }

            if (data[field.id]) {
                // Validation du type
                if (field.type === 'number' && isNaN(Number(data[field.id]))) {
                    errors.push(`Le champ "${field.label}" doit être un nombre`);
                }
            }
        });

        if (errors.length > 0) {
            throw new ValidationError(errors.join(', '));
        }

        return true;
    },

    /**
     * Obtenir les détails complets d'un rapport
     */
    async getReportDetails(reportId) {
        const result = await db.query(
            `SELECT r.*, 
              t.name as template_name, 
              t.frequency,
              u.full_name as author_name,
              u.email as author_email,
              v.full_name as validator_name,
              d.name as department_name
       FROM reports r
       JOIN report_templates t ON r.template_id = t.id
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users v ON r.validated_by = v.id
       JOIN departments d ON r.department_id = d.id
       WHERE r.id = $1`,
            [reportId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Rapport non trouvé');
        }

        return result.rows[0];
    },

    /**
     * Calculer des statistiques pour un département
     */
    async calculateDepartmentStats(departmentId, startDate = null, endDate = null) {
        let query = `
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated_reports,
        COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN status = 'rejete' THEN 1 END) as rejected_reports,
        COUNT(CASE WHEN status = 'brouillon' THEN 1 END) as draft_reports,
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

        // Calculer des métriques additionnelles
        const total = parseInt(stats.total_reports) || 0;
        const validated = parseInt(stats.validated_reports) || 0;
        const rejected = parseInt(stats.rejected_reports) || 0;

        return {
            ...stats,
            validation_rate: total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
            rejection_rate: total > 0 ? ((rejected / total) * 100).toFixed(2) : 0,
            avg_validation_time_hours: parseFloat(stats.avg_validation_time_hours || 0).toFixed(2)
        };
    }
};

module.exports = reportService;