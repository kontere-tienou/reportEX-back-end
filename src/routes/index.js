/**
 * ==========================================
 * ROUTES INDEX
 * ==========================================
 */

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const departmentRoutes = require("./departmentRoutes");
const employeeRoutes = require("./employeeRoutes");
const notificationRoutes = require("./notificationRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const managementRoutes = require("./namagmentRoutes");
const reportAccessRoutes = require("./reportAccessRequestRoutes");
const reportRoutes = require("./reportRoutes");
const departmentDataRoutes = require("./departmentDataRoutes");
const schemaRoutes = require("./schemaRoutes");


const configureRoutes = (app) => {
  // Health check
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      message: "BATEX ERP API is running",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API version 1 routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/management", managementRoutes);
  app.use("/api/report-access", reportAccessRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api", departmentDataRoutes);
  app.use("/api/schemas", schemaRoutes);
  //app.use("/api/report-history", reportHistoryRoutes);

  // 404 handler - must be after all routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Route non trouvée",
      path: req.path,
      method: req.method,
    });
  });
};

module.exports = configureRoutes;
