/**
 * ==========================================
 * MODELS INDEX
 * Export all models for easy import
 * ==========================================
 */
const User = require("./userModel");
const Department = require("./departmentModel");
const Employee = require("./employee");
const Notification = require("./Notification");
const AuditLog = require("./AuditLog");



module.exports = {
  User,
  Department,
  Employee,
  Notification,
  AuditLog,
};
