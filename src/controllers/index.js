/**
 * ==========================================
 * CONTROLLERS INDEX
 * Export all controllers
 * ==========================================
 */

const authController = require("./authController");
const userController = require("./userController");
const departmentController = require("./departmentController");
const employeeController = require("./employeeController");
const notificationController = require("./notificationController");
const departmentDataController = require("../controllers/departmentDataController");

module.exports = {
  authController,
  userController,
  departmentController,
  employeeController,
  notificationController,
  departmentDataController,
};
