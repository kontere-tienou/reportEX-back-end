/**
 * ==========================================
 * ROUTES INDEX
 * Central routing configuration
 * ==========================================
 */

const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const departmentRoutes = require("./departmentRoutes");
const employeeRoutes = require("./employeeRoutes");
const notificationRoutes = require("./notificationRoutes");

/**
 * Configure all routes
 */
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
