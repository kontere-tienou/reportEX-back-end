// /models/departmentModel.js

const db = require("../config/database");

// IT department-related queries
const ITDepartment = {
  // Get all tickets assigned to IT department
  async getTickets() {
    const result = await db.query(
      "SELECT * FROM tickets WHERE department_id = $1",
      [10], // Assuming IT department has ID 10
    );
    return result.rows;
  },

  // Get all IT systems
  async getSystems() {
    const result = await db.query(
      "SELECT * FROM systems WHERE department_id = $1",
      [10], // Assuming IT department has ID 10
    );
    return result.rows;
  },
};

module.exports = ITDepartment;
