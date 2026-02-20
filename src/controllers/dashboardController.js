const dashboardService = require("../services/dashboardService");

exports.getDirectionDashboard = async (req, res, next) => {
  try {
    const globalStats = await dashboardService.getGlobalStats();
    const departmentPerformance =
      await dashboardService.getDepartmentPerformance();
    const statusDistribution = await dashboardService.getStatusDistribution();
    const alerts = await dashboardService.getAlerts();

    res.json({
      globalStats,
      departmentPerformance,
      statusDistribution,
      alerts,
    });
  } catch (err) {
    next(err);
  }
};
