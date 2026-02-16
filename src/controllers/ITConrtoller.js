// /controllers/itController.js

const ITDepartment = require("../models/ITDepartment");

const itController = {
  // Create a new IT ticket
  async createTicket(req, res) {
    const { title, description, priority } = req.body;

    if (!title || !description || !priority) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and priority are required.",
      });
    }

    try {
      const result = await db.query(
        "INSERT INTO tickets (title, description, priority, department_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [title, description, priority, 10], 
      );

      res.status(201).json({
        success: true,
        message: "Ticket created successfully",
        ticket: result.rows[0],
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({
        success: false,
        message: "Error creating ticket",
      });
    }
  },
  // Get all tickets for IT department
  async getTickets(req, res) {
    try {
      const tickets = await TicketModel.getTickets();
      res.status(200).json({
        success: true,
        tickets
      });
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching tickets'
      });
    }
  },
  // Create a new IT ticket (addressed to IT department)
  async createTicket(req, res) {
    const { title, description, priority, department_id } = req.body;

    if (!title || !description || !priority || !department_id) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, priority, and department_id are required.'
      });
    }

    try {
      const ticket = await TicketModel.createTicket({ title, description, priority, department_id });
      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        ticket
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating ticket'
      });
    }
  },
  // Update a ticket status (e.g., open, in-progress, closed)
  async updateTicket(req, res) {
    const { id } = req.params;
    const { status, assigned_to } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    try {
      const updatedTicket = await TicketModel.updateTicket(id, status, assigned_to);
      res.status(200).json({
        success: true,
        message: 'Ticket updated successfully',
        ticket: updatedTicket
      });
    } catch (error) {
      console.error('Error updating ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating ticket'
      });
    }
  },
  // Get a specific ticket
  async getTicketById(req, res) {
    const { id } = req.params;

    try {
      const ticket = await TicketModel.getTicketById(id);
      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }

      res.status(200).json({
        success: true,
        ticket
      });
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching ticket'
      });
    }
  },
  // Assign a ticket to IT staff
async assignTicket(req, res) {
  const { id } = req.params;
  const { assigned_to } = req.body; // IT staff user ID

  if (!assigned_to) {
    return res.status(400).json({ success: false, message: 'Assigned IT staff ID is required.' });
  }

  try {
    const ticket = await TicketModel.updateTicket(id, 'in-progress', assigned_to);
    res.status(200).json({ success: true, message: 'Ticket assigned successfully', ticket });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ success: false, message: 'Error assigning ticket' });
  }
},
  // Delete a ticket
  async deleteTicket(req, res) {
    const { id } = req.params;

    try {
      const deletedTicket = await TicketModel.deleteTicket(id);
      res.status(200).json({
        success: true,
        message: 'Ticket deleted successfully',
        ticket: deletedTicket
      });
    } catch (error) {
      console.error('Error deleting ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting ticket'
      });
    }
  },
  // Get all IT systems
  async getSystemStatus(req, res) {
    try {
      const systems = await SystemModel.getSystemStatus();
      res.status(200).json({ success: true, systems });
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({ success: false, message: 'Error fetching system status' });
    }
  },

  // Update system status (e.g., online, offline, maintenance)
  async updateSystemStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const updatedSystem = await SystemModel.updateSystemStatus(id, status);
      res.status(200).json({ success: true, message: 'System status updated', system: updatedSystem });
    } catch (error) {
      console.error('Error updating system status:', error);
      res.status(500).json({ success: false, message: 'Error updating system status' });
    }
  },
  // Create a new system entry
  async createSystem(req, res) {
    const { name, type, status } = req.body;

    if (!name || !type || !status) {
      return res.status(400).json({
        success: false,
        message: "Name, type, and status are required.",
      });
    }

    try {
      const result = await db.query(
        "INSERT INTO systems (name, type, status, department_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, type, status, 10], // IT department ID is 10
      );

      res.status(201).json({
        success: true,
        message: "System created successfully",
        system: result.rows[0],
      });
    } catch (error) {
      console.error("Error creating system:", error);
      res.status(500).json({
        success: false,
        message: "Error creating system",
      });
    }
  },

};

module.exports = itController;
