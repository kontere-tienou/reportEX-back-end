const db = require("../config/database");

const dashboardService = {
  /* ===============================
     GLOBAL STATS
  =============================== */
  async getGlobalStats(startDate = null, endDate = null) {
    let query = `
      SELECT
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status='valide' THEN 1 END) as validated,
        COUNT(CASE WHEN status='soumis' THEN 1 END) as submitted,
        COUNT(CASE WHEN status='rejete' THEN 1 END) as rejected,
        COUNT(CASE WHEN status='brouillon' THEN 1 END) as draft,
        AVG(
          CASE
            WHEN status='valide'
            AND submitted_at IS NOT NULL
            AND validated_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (validated_at - submitted_at))/3600
          END
        ) as avg_validation_time
      FROM reports
    `;

    const result = await db.query(query);

    const stats = result.rows[0];

    const total = parseInt(stats.total_reports) || 0;
    const validated = parseInt(stats.validated) || 0;

    return {
      ...stats,
      validation_rate: total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
    };
  },

  /* ===============================
     PERFORMANCE PAR DEPARTEMENT
  =============================== */
  async getDepartmentPerformance() {
    const result = await db.query(`
      SELECT
        d.id,
        d.name,
        COUNT(r.id) as total,
        COUNT(CASE WHEN r.status='valide' THEN 1 END) as validated
      FROM departments d
      LEFT JOIN reports r ON r.department_id=d.id
      GROUP BY d.id
      ORDER BY d.name
    `);

    return result.rows.map((row) => {
      const total = parseInt(row.total) || 0;
      const validated = parseInt(row.validated) || 0;
      return {
        ...row,
        validation_rate: total > 0 ? ((validated / total) * 100).toFixed(2) : 0,
      };
    });
  },

  /* ===============================
     STATUS DISTRIBUTION
  =============================== */
  async getStatusDistribution() {
    const result = await db.query(`
      SELECT status, COUNT(*) as count
      FROM reports
      GROUP BY status
    `);

    return result.rows.map((row) => ({
      name: row.status,
      value: parseInt(row.count),
    }));
  },

  /* ===============================
     ALERTES
  =============================== */
  async getAlerts() {
    const alerts = [];

    // 1️⃣ Départements avec faible taux
    const lowPerf = await db.query(`
      SELECT d.name,
        COUNT(r.id) as total,
        COUNT(CASE WHEN r.status='valide' THEN 1 END) as validated
      FROM departments d
      LEFT JOIN reports r ON r.department_id=d.id
      GROUP BY d.id
    `);

    lowPerf.rows.forEach((row) => {
      const total = parseInt(row.total) || 0;
      const validated = parseInt(row.validated) || 0;

      if (total > 0) {
        const rate = (validated / total) * 100;
        if (rate < 80) {
          alerts.push({
            type: "performance",
            message: `${row.name} a un taux faible (${rate.toFixed(1)}%)`,
          });
        }
      }
    });

    // 2️⃣ Rapports soumis depuis +5 jours
    const lateReports = await db.query(`
      SELECT id FROM reports
      WHERE status='soumis'
      AND submitted_at < NOW() - INTERVAL '5 days'
    `);

    if (lateReports.rows.length > 0) {
      alerts.push({
        type: "delay",
        message: `${lateReports.rows.length} rapports en attente depuis plus de 5 jours`,
      });
    }

    return alerts;
  },
};

module.exports = dashboardService;
