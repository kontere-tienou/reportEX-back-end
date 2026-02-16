// /models/ticketModel.js

const db = require("../config/database");

// IT department ticket model
const TicketModel = {
  // Create a new ticket addressed to IT department
  async createTicket({ title, description, priority, department_id }) {
    const result = await db.query(
      "INSERT INTO tickets (title, description, priority, status, department_id, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [title, description, priority, "open", department_id, null],
    );
    return result.rows[0];
  },

  // Get all tickets assigned to IT department
  async getTickets() {
    const result = await db.query(
      "SELECT * FROM tickets WHERE department_id = $1",
      [10],
    ); // Assuming IT department ID is 10
    return result.rows;
  },

  // Update ticket status (e.g., open, in-progress, closed)
  async updateTicket(id, status, assigned_to) {
    const result = await db.query(
      "UPDATE tickets SET status = $1, assigned_to = $2 WHERE id = $3 RETURNING *",
      [status, assigned_to, id],
    );
    return result.rows[0];
  },

  // Get ticket details by ID
  async getTicketById(id) {
    const result = await db.query("SELECT * FROM tickets WHERE id = $1", [id]);
    return result.rows[0];
  },

  // Delete a ticket
  async deleteTicket(id) {
    const result = await db.query(
      "DELETE FROM tickets WHERE id = $1 RETURNING *",
      [id],
    );
    return result.rows[0];
  },
};

module.exports = TicketModel;
