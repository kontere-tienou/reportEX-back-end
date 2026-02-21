const db = require("../config/database");

/**
 * ==========================================
 * AUDIT LOG MODEL
 * ==========================================
 */

class AuditLog {
  /**
   * Create audit log entry
   */
  static async create(data) {
    const {
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      ip_address,
      user_agent,
    } = data;

    const result = await db.query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, 
        details, ip_address, user_agent, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        user_id,
        action,
        entity_type,
        entity_id,
        JSON.stringify(details),
        ip_address,
        user_agent,
      ],
    );

    return result.rows[0];
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    const result = await db.query(
      `SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Get all logs with filters
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 50,
      user_id,
      action,
      entity_type,
      entity_id,
      start_date,
      end_date,
    } = filters;

    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    if (user_id) {
      query += ` AND al.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (action) {
      query += ` AND al.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (entity_type) {
      query += ` AND al.entity_type = $${paramCount}`;
      params.push(entity_type);
      paramCount++;
    }

    if (entity_id) {
      query += ` AND al.entity_id = $${paramCount}`;
      params.push(entity_id);
      paramCount++;
    }

    if (start_date) {
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace(/SELECT.*FROM/, "SELECT COUNT(*) FROM");
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user activity
   */
  static async getUserActivity(userId, days = 30) {
    const result = await db.query(
      `SELECT 
        action,
        entity_type,
        COUNT(*) as count,
        MAX(created_at) as last_action
       FROM audit_logs
       WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action, entity_type
       ORDER BY count DESC`,
      [userId],
    );

    return result.rows;
  }

  /**
   * Get entity history
   */
  static async getEntityHistory(entityType, entityId) {
    const result = await db.query(
      `SELECT 
        al.*,
        u.full_name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = $1 AND al.entity_id = $2
       ORDER BY al.created_at DESC`,
      [entityType, entityId],
    );

    return result.rows;
  }

  /**
   * Get stats
   */
  static async getStats(filters = {}) {
    const { start_date, end_date, user_id } = filters;
    const params = [];
    let paramCount = 1;

    let whereClause = "WHERE 1=1";

    if (start_date) {
      whereClause += ` AND created_at >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (user_id) {
      whereClause += ` AND user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    const result = await db.query(
      `SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as creates,
        COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
        COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes,
        COUNT(CASE WHEN action = 'LOGIN' THEN 1 END) as logins
       FROM audit_logs
       ${whereClause}`,
      params,
    );

    return result.rows[0];
  }

  /**
   * Delete old logs
   */
  static async deleteOld(days = 90) {
    const result = await db.query(
      `DELETE FROM audit_logs 
       WHERE created_at < NOW() - INTERVAL '${days} days'
       RETURNING id`,
    );

    return result.rowCount;
  }

  /**
   * Count logs
   */
  static async count(filters = {}) {
    const { user_id, action, entity_type } = filters;
    const params = [];
    let paramCount = 1;

    let query = "SELECT COUNT(*) FROM audit_logs WHERE 1=1";

    if (user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (action) {
      query += ` AND action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (entity_type) {
      query += ` AND entity_type = $${paramCount}`;
      params.push(entity_type);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
  }
}

module.exports = AuditLog;
