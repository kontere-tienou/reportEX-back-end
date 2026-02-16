const db = require('../config/database');

const notificationController = {
  // Créer un nouveau rapport global (pour tous les utilisateurs)
  async createGlobalNotification(req, res) {
    const { title, message } = req.body;
  
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
  
    try {
      const users = await db.query('SELECT id FROM users WHERE is_active = true');
  
      // Create notification for all active users
      const notificationPromises = users.rows.map(user =>
        db.query('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)', [user.id, title, message, 'system'])
      );
  
      await Promise.all(notificationPromises);
  
      res.status(200).json({ success: true, message: 'Global notification sent to all users' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error sending notification' });
    }
  },
  // Récupérer les notifications de l'utilisateur
  async getNotifications(req, res) {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = req.query;

      let query = `
        SELECT id, type, title, message, link, is_read, created_at
        FROM notifications
        WHERE user_id = $1
      `;

      const params = [req.user.id];

      if (unreadOnly === "true") {
        query += ` AND is_read = false`;
      }

      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Compter les non lues
      const countResult = await db.query(
        "SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false",
        [req.user.id],
      );

      res.json({
        success: true,
        notifications: result.rows,
        unreadCount: parseInt(countResult.rows[0].unread_count),
      });
    } catch (error) {
      console.error("Erreur récupération notifications:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la récupération des notifications",
      });
    }
  },
  // Marquer une notification comme lue
  async markAsRead(req, res) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE notifications 
         SET is_read = true
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification non trouvée",
        });
      }

      res.json({
        success: true,
        message: "Notification marquée comme lue",
      });
    } catch (error) {
      console.error("Erreur marquer notification:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour de la notification",
      });
    }
  },
  // Marquer toutes les notifications comme lues
  async markAllAsRead(req, res) {
    try {
      await db.query(
        `UPDATE notifications 
         SET is_read = true
         WHERE user_id = $1 AND is_read = false`,
        [req.user.id],
      );

      res.json({
        success: true,
        message: "Toutes les notifications ont été marquées comme lues",
      });
    } catch (error) {
      console.error("Erreur marquer toutes notifications:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la mise à jour des notifications",
      });
    }
  },
};

module.exports = notificationController;