// controllers/managementController.js

const db = require("../config/database");
const notificationService = require("../service/notificationService");
const reportService = require("../service/reportService");

const managementController = {
  // Vue Consolidée: Get consolidated view with key metrics for departments
  async getConsolidatedView(req, res) {
    try {
      // Example: Get total number of reports, departments, and active users
      const result = await db.query(
        `SELECT 
          COUNT(*) AS total_reports, 
          COUNT(DISTINCT department_id) AS total_departments,
          COUNT(DISTINCT user_id) AS total_users
        FROM reports`,
      );

      res.status(200).json({
        success: true,
        metrics: result.rows[0],
      });
    } catch (error) {
      console.error("Error fetching consolidated view:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching consolidated view",
      });
    }
  },

  // Get all departments for management purposes
  async getAllDepartments(req, res) {
    try {
      const departments = await db.query(
        "SELECT id, name, code, description, is_active FROM departments ORDER BY name",
      );

      res.status(200).json({
        success: true,
        departments: departments.rows,
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching departments",
      });
    }
  },

  // Manage Objectives: Create, update, get objectives for the organization
  async getObjectives(req, res) {
    try {
      const result = await db.query(
        "SELECT * FROM objectives ORDER BY deadline DESC",
      );

      res.status(200).json({
        success: true,
        objectives: result.rows,
      });
    } catch (error) {
      console.error("Error fetching objectives:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching objectives",
      });
    }
  },

  // Create a new objective (for Direction)
  async createObjective(req, res) {
    const { title, description, deadline, department_id } = req.body;

    if (!title || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and deadline are required.",
      });
    }

    try {
      const result = await db.query(
        "INSERT INTO objectives (title, description, deadline, department_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, deadline, department_id],
      );

      res.status(201).json({
        success: true,
        message: "Objective created successfully",
        objective: result.rows[0],
      });
    } catch (error) {
      console.error("Error creating objective:", error);
      res.status(500).json({
        success: false,
        message: "Error creating objective",
      });
    }
  },

  // Validate Report (only for admin and validateur)
  async validateReport(req, res) {
    const { id } = req.params; // report ID
    const { status, comments } = req.body; // validation status ('valide' or 'rejete')

    if (!["valide", "rejete"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Please provide "valide" or "rejete".',
      });
    }

    try {
      // Validate the report
      const report = await reportService.validateReport(
        id,
        status,
        comments,
        req.user.id,
      );

      // Send notification to the report author
      const reportDetails = await reportService.getReportDetails(id);
      await notificationService.notifyAuthor(
        reportDetails.user_id,
        id,
        status,
        req.user.full_name,
        comments,
      );

      res.status(200).json({
        success: true,
        message: `Report ${status === "valide" ? "validated" : "rejected"} successfully`,
        report,
      });
    } catch (error) {
      console.error("Error validating report:", error);
      res.status(500).json({
        success: false,
        message: "Error validating report",
      });
    }
  },
};

module.exports = managementController;
