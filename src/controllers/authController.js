const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authController = {
  // Connexion
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Nom d'utilisateur et mot de passe requis",
        });
      }

      // Rechercher l'utilisateur
      const result = await db.query(
        `SELECT u.*, d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.username = $1 AND u.is_active = true`,
        [username],
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Nom d'utilisateur  incorrects",
        });
      }

      const user = result.rows[0];

      // Vérifier le mot de passe
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Mot de passe incorrect",
        });
      }

      // Générer le token JWT
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          department_id: user.department_id,
        },
        process.env.JWT_SECRET,
        console.log("JWT_SECRET:", process.env.JWT_SECRET),
        { expiresIn: process.env.JWT_EXPIRE },
      );

      // Log de connexion
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [user.id, "LOGIN", "user", req.ip],
      );

      res.json({
        success: true,
        message: "Connexion réussie",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          department: {
            id: user.department_id,
            name: user.department_name,
            code: user.department_code,
          },
        },
      });
    } catch (error) {
      console.error("Erreur login:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la connexion",
      });
    }
  },
  // Récupérer le profil utilisateur
  async getProfile(req, res) {
    try {
      const result = await db.query(
        `SELECT u.id, u.username, u.email, u.full_name, u.role,
                d.id as department_id, d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = $1`,
        [req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé",
        });
      }

      const user = result.rows[0];

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          department: {
            id: user.department_id,
            name: user.department_name,
            code: user.department_code,
          },
        },
      });
    } catch (error) {
      console.error("Erreur profil:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération du profil",
      });
    }
  },
  // Changer le mot de passe
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Tous les champs sont requis",
        });
      }

      // Vérifier l'ancien mot de passe
      const result = await db.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user.id],
      );

      const isMatch = await bcrypt.compare(
        currentPassword,
        result.rows[0].password_hash,
      );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Mot de passe actuel incorrect",
        });
      }

      // Hacher le nouveau mot de passe
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Mettre à jour
      await db.query(
        "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [newPasswordHash, req.user.id],
      );

      res.json({
        success: true,
        message: "Mot de passe modifié avec succès",
      });
    } catch (error) {
      console.error("Erreur changement mot de passe:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors du changement de mot de passe",
      });
    }
  },
  // user creation (for admin use)
  async registerUser(req, res) {
    const { username, email, fullName, departmentId, role, password } =
      req.body;

    // Validate required fields
    if (
      !username ||
      !email ||
      !fullName ||
      !departmentId ||
      !role ||
      !password
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }

    try {
      // Check if username or email already exists
      const userExists = await db.query(
        "SELECT * FROM users WHERE username = $1 OR email = $2",
        [username, email],
      );
      if (userExists.rows.length > 0) {
        return res
          .status(409)
          .json({
            success: false,
            message: "Username or Email already exists.",
          });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await db.query(
        "INSERT INTO users (username, email, full_name, department_id, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [username, email, fullName, departmentId, role, hashedPassword],
      );

      // Return success response
      res
        .status(201)
        .json({
          success: true,
          message: "User registered successfully",
          user: newUser.rows[0],
        });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error registering user" });
    }
  },
};

module.exports = authController;