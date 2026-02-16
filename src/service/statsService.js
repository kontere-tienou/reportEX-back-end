const db = require("../config/database");
const logger = require("../config/logger");

const statsService = {
  /**
   * Obtenir les statistiques du tableau de bord selon le rôle
   */
  async getDashboardStats(userId, departmentId, role) {
    try {
      if (role === "admin") {
        return await this.getGlobalStats();
      } else if (role === "validateur") {
        return await this.getValidatorStats(userId);
      } else {
        return await this.getUserStats(userId, departmentId);
      }
    } catch (error) {
      logger.error("Error getting dashboard stats:", error);
      throw error;
    }
  },

  /**
   * Statistiques globales (Admin)
   */
  async getGlobalStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated_reports,
          COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending_reports,
          COUNT(CASE WHEN status = 'rejete' THEN 1 END) as rejected_reports,
          COUNT(CASE WHEN status = 'brouillon' THEN 1 END) as draft_reports,
          COUNT(DISTINCT department_id) as active_departments,
          COUNT(DISTINCT user_id) as active_users
        FROM reports
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      const stats = result.rows[0];

      // Calculer des métriques supplémentaires
      const total = parseInt(stats.total_reports) || 0;
      const validated = parseInt(stats.validated_reports) || 0;
      const rejected = parseInt(stats.rejected_reports) || 0;

      return {
        ...stats,
        validation_rate: total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
        rejection_rate: total > 0 ? ((rejected / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      logger.error("Error getting global stats:", error);
      throw error;
    }
  },

  /**
   * Statistiques utilisateur (Responsable)
   */
  async getUserStats(userId, departmentId) {
    try {
      const result = await db.query(
        `
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
        WHERE user_id = $1 AND department_id = $2
      `,
        [userId, departmentId],
      );

      const stats = result.rows[0];

      // Calculer taux de validation
      const total = parseInt(stats.total_reports) || 0;
      const validated = parseInt(stats.validated_reports) || 0;
      const rejected = parseInt(stats.rejected_reports) || 0;

      return {
        ...stats,
        validation_rate: total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
        rejection_rate: total > 0 ? ((rejected / total) * 100).toFixed(2) : 0,
        avg_validation_time_hours: parseFloat(
          stats.avg_validation_time_hours || 0,
        ).toFixed(2),
      };
    } catch (error) {
      logger.error("Error getting user stats:", error);
      throw error;
    }
  },

  /**
   * Statistiques validateur
   */
  async getValidatorStats(validatorId) {
    try {
      const result = await db.query(
        `
        SELECT 
          COUNT(*) as total_validations,
          COUNT(CASE WHEN v.status = 'approuve' THEN 1 END) as approved,
          COUNT(CASE WHEN v.status = 'rejete' THEN 1 END) as rejected,
          AVG(EXTRACT(EPOCH FROM (v.validated_at - r.submitted_at))/3600) as avg_time_hours,
          COUNT(DISTINCT r.department_id) as departments_covered
        FROM validations v
        JOIN reports r ON v.report_id = r.id
        WHERE v.validator_id = $1
          AND v.validated_at >= NOW() - INTERVAL '30 days'
      `,
        [validatorId],
      );

      const stats = result.rows[0];

      // Rapports en attente de validation
      const pendingResult = await db.query(`
        SELECT COUNT(*) as pending_validations
        FROM reports
        WHERE status = 'soumis'
      `);

      return {
        ...stats,
        pending_validations: parseInt(
          pendingResult.rows[0].pending_validations,
        ),
        avg_time_hours: parseFloat(stats.avg_time_hours || 0).toFixed(2),
      };
    } catch (error) {
      logger.error("Error getting validator stats:", error);
      throw error;
    }
  },

  /**
   * Données de tendance pour graphiques
   */
  async getTrendData(departmentId, months = 6) {
    try {
      const result = await db.query(
        `
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated,
          COUNT(CASE WHEN status = 'rejete' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending
        FROM reports
        WHERE department_id = $1
          AND created_at >= NOW() - INTERVAL '${months} months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `,
        [departmentId],
      );

      return result.rows.map((row) => ({
        month: new Date(row.month).toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        }),
        total: parseInt(row.total),
        validated: parseInt(row.validated),
        rejected: parseInt(row.rejected),
        pending: parseInt(row.pending),
      }));
    } catch (error) {
      logger.error("Error getting trend data:", error);
      throw error;
    }
  },

  /**
   * Statistiques par département pour la direction
   */
  async getDepartmentComparison() {
    try {
      const result = await db.query(`
        SELECT 
          d.name as department_name,
          d.code as department_code,
          COUNT(r.id) as total_reports,
          COUNT(CASE WHEN r.status = 'valide' THEN 1 END) as validated,
          COUNT(CASE WHEN r.status = 'soumis' THEN 1 END) as pending,
          COUNT(CASE WHEN r.status = 'rejete' THEN 1 END) as rejected
        FROM departments d
        LEFT JOIN reports r ON d.id = r.department_id 
          AND r.created_at >= NOW() - INTERVAL '30 days'
        WHERE d.is_active = true
        GROUP BY d.id, d.name, d.code
        ORDER BY total_reports DESC
      `);

      return result.rows.map((row) => {
        const total = parseInt(row.total_reports) || 0;
        const validated = parseInt(row.validated) || 0;

        return {
          ...row,
          total_reports: total,
          validated: validated,
          pending: parseInt(row.pending) || 0,
          rejected: parseInt(row.rejected) || 0,
          completion_rate:
            total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
        };
      });
    } catch (error) {
      logger.error("Error getting department comparison:", error);
      throw error;
    }
  },

  /**
   * Top performers (départements avec meilleur taux de validation)
   */
  async getTopPerformers(limit = 5) {
    try {
      const result = await db.query(
        `
        SELECT 
          d.name as department_name,
          COUNT(r.id) as total_reports,
          COUNT(CASE WHEN r.status = 'valide' THEN 1 END) as validated,
          ROUND(
            COUNT(CASE WHEN r.status = 'valide' THEN 1 END)::numeric / 
            NULLIF(COUNT(r.id), 0) * 100, 
            2
          ) as validation_rate
        FROM departments d
        JOIN reports r ON d.id = r.department_id
        WHERE r.created_at >= NOW() - INTERVAL '30 days'
          AND d.is_active = true
        GROUP BY d.id, d.name
        HAVING COUNT(r.id) > 0
        ORDER BY validation_rate DESC, total_reports DESC
        LIMIT $1
      `,
        [limit],
      );

      return result.rows;
    } catch (error) {
      logger.error("Error getting top performers:", error);
      throw error;
    }
  },

  /**
   * Temps moyen de validation par département
   */
  async getAverageValidationTime() {
    try {
      const result = await db.query(`
        SELECT 
          d.name as department_name,
          AVG(EXTRACT(EPOCH FROM (r.validated_at - r.submitted_at))/3600) as avg_hours,
          COUNT(r.id) as reports_count
        FROM departments d
        JOIN reports r ON d.id = r.department_id
        WHERE r.status = 'valide'
          AND r.submitted_at IS NOT NULL
          AND r.validated_at IS NOT NULL
          AND r.validated_at >= NOW() - INTERVAL '30 days'
        GROUP BY d.id, d.name
        ORDER BY avg_hours ASC
      `);

      return result.rows.map((row) => ({
        department_name: row.department_name,
        avg_hours: parseFloat(row.avg_hours || 0).toFixed(2),
        reports_count: parseInt(row.reports_count),
      }));
    } catch (error) {
      logger.error("Error getting average validation time:", error);
      throw error;
    }
  },

  /**
   * Statistiques hebdomadaires
   */
  async getWeeklyStats(departmentId) {
    try {
      const result = await db.query(
        `
        SELECT 
          COUNT(*) as reports_this_week,
          COUNT(CASE WHEN status = 'valide' THEN 1 END) as validated_this_week,
          COUNT(CASE WHEN status = 'soumis' THEN 1 END) as pending_this_week
        FROM reports
        WHERE department_id = $1
          AND created_at >= DATE_TRUNC('week', NOW())
      `,
        [departmentId],
      );

      return result.rows[0];
    } catch (error) {
      logger.error("Error getting weekly stats:", error);
      throw error;
    }
  },
};

module.exports = statsService;
