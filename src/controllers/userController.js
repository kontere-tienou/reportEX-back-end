const db = require("../config/database");
const bcrypt = require("bcryptjs");

const userController = {
  // 🔹 GET ALL USERS (Admin only)
  async getAllUsers(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ success: false, message: "Accès refusé" });
      }

      const result = await db.query(`
        SELECT u.id, u.username, u.email, u.full_name, u.role,
               u.is_active, u.created_at,
               d.id as department_id,
               d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.created_at DESC
      `);

      res.json({
        success: true,
        users: result.rows,
      });
    } catch (error) {
      console.error("Erreur getAllUsers:", error);
      res.status(500).json({ success: false });
    }
  },

  // 🔹 GET SINGLE USER
  async getUser(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `
        SELECT id, username, email, full_name, role, department_id, is_active
        FROM users
        WHERE id = $1
      `,
        [id],
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Utilisateur non trouvé" });
      }

      res.json({
        success: true,
        user: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false });
    }
  },

  // 🔹 CREATE USER (Admin only)
  async createUser(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ success: false, message: "Accès refusé" });
      }

      const { username, email, full_name, department_id, role, password } =
        req.body;

      if (
        !username ||
        !email ||
        !full_name ||
        !department_id ||
        !role ||
        !password
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Tous les champs sont requis" });
      }

      const exists = await db.query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );

      if (exists.rowCount > 0) {
        return res
          .status(409)
          .json({ success: false, message: "Username ou Email déjà utilisé" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.query(
        `
        INSERT INTO users (username, email, full_name, department_id, role, password_hash)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, username, email, full_name, role, department_id
      `,
        [username, email, full_name, department_id, role, hashedPassword],
      );

      res.status(201).json({
        success: true,
        message: "Utilisateur créé",
        user: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false });
    }
  },

  // 🔹 UPDATE USER
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { full_name, email, role, department_id } = req.body;

      const result = await db.query(
        `
        UPDATE users
        SET full_name = $1,
            email = $2,
            role = $3,
            department_id = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        RETURNING id, username, email, full_name, role, department_id
      `,
        [full_name, email, role, department_id, id],
      );

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Utilisateur non trouvé" });
      }

      res.json({
        success: true,
        message: "Utilisateur mis à jour",
        user: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false });
    }
  },

  // 🔹 ACTIVATE / DEACTIVATE USER
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;

      await db.query(
        `
        UPDATE users
        SET is_active = NOT is_active,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        [id],
      );

      res.json({ success: true, message: "Statut modifié" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false });
    }
  },

  // 🔹 DELETE USER
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      await db.query("DELETE FROM users WHERE id = $1", [id]);

      res.json({ success: true, message: "Utilisateur supprimé" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false });
    }
  },
};

module.exports = userController;
