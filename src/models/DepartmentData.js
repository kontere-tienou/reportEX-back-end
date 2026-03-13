const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

/**
 * ==========================================
 * DEPARTMENT DATA MODEL - PostgreSQL Version
 * ==========================================
 */

class DepartmentData {
  /**
   * Get table name based on department code
   */
  static getTableName(deptCode) {
    const tableMap = {
      IMPRESSION: "impression_data",
      CONFECTION: "confection_data",
      TEINTURE: "teinture_data",
      PRODUCTION: "production_data",
      IT: "it_data",
      RH: "rh_data",
      ACHATS: "achat_data",
      BUREAU_ETUDE: "bureau_etude_data",
      COMMERCIAL: "commercial_data",
      COMPTABILITE: "comptabilite_data",
      DG: "dg_data",
      DEFAULT: "department_data",
    };
    return tableMap[deptCode] || tableMap.DEFAULT;
  }

  /**
   * Find all data entries for a department
   */
  static async findAll(deptCode, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        dateFrom,
        dateTo,
        userId,
        sortBy = "date",
        sortOrder = "DESC",
      } = options;
      const tableName = this.getTableName(deptCode);

      console.log("Table name:", tableName);

      const offset = (page - 1) * limit;

      // Check if table exists in PostgreSQL
      const tableCheck = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )`,
        [tableName],
      );

      const tableExists = tableCheck.rows[0].exists;
      console.log("Table exists:", tableExists);

      if (!tableExists) {
        throw new Error(`Table ${tableName} does not exist`);
      }

      // Build dynamic query with PostgreSQL syntax
      let query = `SELECT * FROM ${tableName} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      // Filters
      if (dateFrom) {
        query += ` AND date >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }
      if (dateTo) {
        query += ` AND date <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }
      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      // Count total before pagination
      const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || 0);

      // Add sorting and pagination with PostgreSQL syntax
      query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      console.log("Final query:", query);
      console.log("Params:", params);

      const result = await db.query(query, params);

      return {
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("FindAll error DETAILED:", error);
      throw error;
    }
  }

  /**
   * Find data by ID
   */
  static async findById(deptCode, id) {
    const tableName = this.getTableName(deptCode);
    const result = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Create new data entry
   
  static async create(deptCode, data) {
    try {
      const tableName = this.getTableName(deptCode);
      const now = new Date().toISOString();

      const { date, user_id, ...otherFields } = data;

      // Build dynamic query based on schema
      const fields = [
        "id",
        "date",
        "user_id",
        "created_at",
        "updated_at",
        ...Object.keys(otherFields),
      ];
      const values = [
        id,
        date,
        user_id,
        now,
        now,
        ...Object.values(otherFields),
      ];

      // Create placeholders ($1, $2, etc.) for PostgreSQL
      const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");

      const query = `
            INSERT INTO ${tableName} (${fields.join(", ")})
            VALUES (${placeholders})
            RETURNING *
        `;
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Model create error:", error);
      throw error;
    }
  }*/
  static async create(deptCode, data) {
    try {
      const tableName = this.getTableName(deptCode);
      const now = new Date().toISOString();
      const { date, user_id, ...otherFields } = data;
      const fields = [
        "date",
        "user_id",
        "created_at",
        "updated_at",
        ...Object.keys(otherFields),
      ];

      const values = [date, user_id, now, now, ...Object.values(otherFields)];

      const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");

      const query = `
              INSERT INTO ${tableName} (${fields.join(", ")})
              VALUES (${placeholders})
              RETURNING *
          `;

      console.log("Create query:", query);
      console.log("Create values:", values);

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Model create error:", error);
      throw error;
    }
  }

  static async update(deptCode, id, data) {
    const tableName = this.getTableName(deptCode);
    const now = new Date().toISOString();

    const { date, ...otherFields } = data;

    // Build SET clause dynamically
    const setFields = ["updated_at = $1", "date = $2"];
    const values = [now, date];

    Object.keys(otherFields).forEach((key, index) => {
      setFields.push(`${key} = $${index + 3}`);
      values.push(otherFields[key]);
    });

    values.push(id);

    const query = `
      UPDATE ${tableName}
      SET ${setFields.join(", ")}
      WHERE id = $${values.length}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete data entry
   */
  static async delete(deptCode, id) {
    const tableName = this.getTableName(deptCode);
    const result = await db.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
      [id],
    );
    return result.rowCount > 0;
  }

  /**
   * Get statistics for department
   */
  static async getStats(deptCode, userId = null) {
    const tableName = this.getTableName(deptCode);
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
      .toISOString()
      .split("T")[0];

    let params = [];
    let paramIndex = 1;
    let userFilter = "";

    // Total
    const totalResult = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName}`,
    );
    const total = parseInt(totalResult.rows[0]?.total || 0);

    // This month
    let monthQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE date >= $1`;
    let monthParams = [firstDayOfMonth];

    if (userId) {
      monthQuery += ` AND user_id = $2`;
      monthParams.push(userId);
    }

    const monthResult = await db.query(monthQuery, monthParams);
    const thisMonth = parseInt(monthResult.rows[0]?.count || 0);

    // This week
    let weekQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE date >= $1`;
    let weekParams = [firstDayOfWeek];

    if (userId) {
      weekQuery += ` AND user_id = $2`;
      weekParams.push(userId);
    }

    const weekResult = await db.query(weekQuery, weekParams);
    const thisWeek = parseInt(weekResult.rows[0]?.count || 0);

    // Today
    let todayQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE date = $1`;
    let todayParams = [today];

    if (userId) {
      todayQuery += ` AND user_id = $2`;
      todayParams.push(userId);
    }

    const todayResult = await db.query(todayQuery, todayParams);
    const todayCount = parseInt(todayResult.rows[0]?.count || 0);

    // Latest entries
    const latestResult = await db.query(
      `SELECT * FROM ${tableName} ORDER BY date DESC LIMIT 5`,
    );

    return {
      total,
      thisMonth,
      thisWeek,
      today: todayCount,
      latestEntries: latestResult.rows || [],
    };
  }

  /**
   * Get data aggregated by date range
   */
  static async getAggregated(deptCode, options = {}) {
    const { dateFrom, dateTo, groupBy = "date", metrics = [] } = options;
    const tableName = this.getTableName(deptCode);

    // First, get existing columns in the table
    const columnsResult = await db.query(
      `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1`,
      [tableName],
    );

    const existingColumns = columnsResult.rows.map((row) => row.column_name);
    console.log(`Existing columns in ${tableName}:`, existingColumns);

    // Filter metrics to only those with existing columns
    const validMetrics = metrics.filter((m) =>
      existingColumns.includes(m.field),
    );

    if (validMetrics.length === 0) {
      // No valid metrics, return empty result with just the groupBy
      const result = await db.query(
        `SELECT ${groupBy} FROM ${tableName} 
             WHERE 1=1 
             ${dateFrom ? "AND date >= $1" : ""} 
             ${dateTo ? "AND date <= $2" : ""} 
             GROUP BY ${groupBy} 
             ORDER BY ${groupBy} DESC`,
        dateFrom && dateTo
          ? [dateFrom, dateTo]
          : dateFrom
            ? [dateFrom]
            : dateTo
              ? [dateTo]
              : [],
      );
      return result.rows;
    }

    // Build query only with valid metrics
    let query = `SELECT ${groupBy}, `;
    const calc = m.calculation || m.aggregation || "sum";
    const aggregates = validMetrics
      .map((m) => {
        switch (calc) {
          case "sum":
            return `COALESCE(SUM(${m.field}), 0) as "${m.field}_sum"`;
          case "avg":
            return `COALESCE(AVG(${m.field}), 0) as "${m.field}_avg"`;
          case "min":
            return `COALESCE(MIN(${m.field}), 0) as "${m.field}_min"`;
          case "max":
            return `COALESCE(MAX(${m.field}), 0) as "${m.field}_max"`;
          case "count":
            return `COUNT(${m.field}) as "${m.field}_count"`;
          default:
            return `COALESCE(SUM(${m.field}), 0) as "${m.field}_sum"`;
        }
      })
      .join(", ");

    query += aggregates + ` FROM ${tableName} WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (dateFrom) {
      query += ` AND date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      query += ` AND date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ` GROUP BY ${groupBy} ORDER BY ${groupBy} DESC`;

    console.log("Aggregated query:", query);
    console.log("Params:", params);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Export data as CSV
   */
  static async exportData(deptCode, options = {}) {
    const { dateFrom, dateTo } = options;
    const tableName = this.getTableName(deptCode);

    let query = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (dateFrom) {
      query += ` AND date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      query += ` AND date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ` ORDER BY date DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = DepartmentData;
