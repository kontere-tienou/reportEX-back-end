const db = require("../config/database");

/**
 * ==========================================
 * NOTIFICATION MODEL
 * ==========================================
 */

class Notification {
  /**
   * Create notification
   */
  static async create(data) {
    const { user_id, type, title, message, link, priority = "normal" } = data;

    const result = await db.query(
      `INSERT INTO notifications (
        user_id, type, title, message, link, priority, 
        is_read, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, false, CURRENT_TIMESTAMP)
      RETURNING *`,
      [user_id, type, title, message, link, priority],
    );

    return result.rows[0];
  }

  /**
   * Create bulk notifications
   */
  static async createBulk(notifications) {
    const values = [];
    const placeholders = [];

    notifications.forEach((notif, index) => {
      const base = index * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, false, CURRENT_TIMESTAMP)`,
      );
      values.push(
        notif.user_id,
        notif.type,
        notif.title,
        notif.message,
        notif.link || null,
        notif.priority || "normal",
      );
    });

    const query = `
      INSERT INTO notifications (
        user_id, type, title, message, link, priority, is_read, created_at
      )
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    const result = await db.query("SELECT * FROM notifications WHERE id = $1", [
      id,
    ]);

    return result.rows[0];
  }

  /**
   * Get user notifications
   */
  static async findByUserId(userId, filters = {}) {
    const { page = 1, limit = 20, is_read, type } = filters;
    const offset = (page - 1) * limit;
    const params = [userId];
    let paramCount = 2;

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;

    if (is_read !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      params.push(is_read);
      paramCount++;
    }

    if (type) {
      query += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      notifications: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark as read
   */
  static async markAsRead(id) {
    const result = await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Mark all as read for user
   */
  static async markAllAsRead(userId) {
    const result = await db.query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId],
    );

    return result.rowCount;
  }

  /**
   * Delete notification
   */
  static async delete(id) {
    const result = await db.query(
      "DELETE FROM notifications WHERE id = $1 RETURNING id",
      [id],
    );

    return result.rows[0];
  }

  /**
   * Delete old notifications
   */
  static async deleteOld(days = 30) {
    const result = await db.query(
      `DELETE FROM notifications 
       WHERE created_at < NOW() - INTERVAL '${days} days'
       AND is_read = true
       RETURNING id`,
    );

    return result.rowCount;
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    const result = await db.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
      [userId],
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get stats
   */
  static async getStats(userId) {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read,
        COUNT(CASE WHEN type = 'approval' THEN 1 END) as approvals,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority
       FROM notifications
       WHERE user_id = $1`,
      [userId],
    );

    return result.rows[0];
  }
}

module.exports = Notification;
