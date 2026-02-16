// /models/systemModel.js

const db = require("../config/database");

// Get the health status of systems
const SystemModel = {
  async getSystemStatus() {
    const result = await db.query("SELECT * FROM systems WHERE status = $1", [
      "online",
    ]);
    return result.rows;
    },
    
    // Update the status of a system
  async updateSystemStatus(id, status) {
    const result = await db.query(
      "UPDATE systems SET status = $1 WHERE id = $2 RETURNING *",
      [status, id],
    );
    return result.rows[0];
  },
};

module.exports = SystemModel;
