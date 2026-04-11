const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

/**
 * ==========================================
 * DEPARTMENT DATA MODEL - PostgreSQL Version
 * ==========================================
 */

// Helpers pour valider les types d'ID
const isValidUUID = (id) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    id,
  );

const isValidInteger = (id) =>
  !isNaN(parseInt(id)) && Number.isInteger(Number(id)) && Number(id) > 0;

// Helper pour obtenir le type de la colonne user_id
const getUserIdColumnType = async (tableName) => {
  try {
    const result = await db.query(
      `
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'user_id'
    `,
      [tableName],
    );

    if (result.rows.length > 0) {
      return result.rows[0].data_type;
    }
    return null;
  } catch (error) {
    console.error("Error detecting user_id column type:", error);
    return null;
  }
};

// Helper pour construire la clause WHERE user_id
const buildUserIdFilter = async (tableName, userId, paramIndex) => {
  if (!userId || userId === "undefined" || userId === null) {
    return { clause: "", params: [], newParamIndex: paramIndex };
  }

  const userIdStr = String(userId);
  const isUuid = isValidUUID(userIdStr);
  const isInt = isValidInteger(userIdStr);
  const columnType = await getUserIdColumnType(tableName);
  // Si la colonne n'existe pas, ignorer
  if (!columnType) {
    return { clause: "", params: [], newParamIndex: paramIndex };
  }

  // UUID column with UUID value
  if (columnType === "uuid" && isUuid) {
    return {
      clause: ` AND user_id = $${paramIndex}::uuid`,
      params: [userIdStr],
      newParamIndex: paramIndex + 1,
    };
  }

  // UUID column with integer value - skip to avoid error
  if (columnType === "uuid" && isInt) {
    return { clause: "", params: [], newParamIndex: paramIndex };
  }

  // Integer column with integer value
  if (columnType === "integer" && isInt) {
    return {
      clause: ` AND user_id = $${paramIndex}`,
      params: [parseInt(userIdStr)],
      newParamIndex: paramIndex + 1,
    };
  }

  // Integer column with UUID - skip
  if (columnType === "integer" && isUuid) {
    return { clause: "", params: [], newParamIndex: paramIndex };
  }

  // Autres cas non reconnus
  return { clause: "", params: [], newParamIndex: paramIndex };
};

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
      INFORMATIQUE: "it_data",
      RH: "rh_data",
      ACHATS: "achat_data",
      BUREAU_ETUDE: "bureau_etude_data",
      COMMERCIAL: "commercial_data",
      COMPTABILITE: "comptabilite_data",
      DG: "dg_data",
    };
    return tableMap[deptCode];
  }

  /**
   * Find all data entries for a department with smart ID handling
   */
  
  static async findAll(
    deptCode,
    { page, limit, dateFrom, dateTo, userId, sortBy, sortOrder },
  ) {
    const tableName = `${deptCode.toLowerCase()}_data`;

    let query = `SELECT * FROM ${tableName}`;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // ⚠️ Vérifiez que userId est bien utilisé correctement
    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (dateFrom) {
      conditions.push(`date >= $${paramIndex++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`date <= $${paramIndex++}`);
      params.push(dateTo);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Ajout ORDER BY
    const safeSortBy = sortBy?.replace(/[^a-zA-Z0-9_]/g, "") || "date";
    const safeSortOrder = sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";
    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    // Ajout LIMIT
    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit));
    }

    // Ajout OFFSET pour pagination
    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` OFFSET $${paramIndex++}`;
      params.push(offset);
    }

    try {
      const result = await db.query(query, params);

      // Pour le comptage total
      let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
      if (conditions.length > 0) {
        countQuery += ` WHERE ${conditions.join(" AND ")}`;
      }
      const countResult = await db.query(
        countQuery,
        params.slice(0, conditions.length),
      );
      const total = parseInt(countResult.rows[0].total);

      return {
        data: result.rows,
        pagination: {
          page: page || 1,
          limit: limit || total,
          total: total,
          pages: limit ? Math.ceil(total / limit) : 1,
        },
      };
    } catch (error) {
      console.error("Database query error:", error);
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
   */
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

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error("Model create error:", error);
      throw error;
    }
  }

  /**
   * Update data entry
   */
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
   * Get statistics for department with smart user filter
   */
  static async getStats(deptCode, userId = null) {
    try {
      const tableName = this.getTableName(deptCode);
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
        .toISOString()
        .split("T")[0];

      // Construire les filtres utilisateur intelligents
      let userClause = "";
      let userParams = [];
      let paramIndex = 1;

      if (userId && userId !== "undefined" && userId !== null) {
        const { clause, params } = await buildUserIdFilter(
          tableName,
          userId,
          paramIndex,
        );
        if (clause) {
          userClause = clause;
          userParams = params;
          paramIndex += params.length;
        }
      }

      // Total
      const totalResult = await db.query(
        `SELECT COUNT(*) as total FROM ${tableName}${userClause}`,
        userParams,
      );
      const total = parseInt(totalResult.rows[0]?.total || 0);

      // This month
      const monthParams = [firstDayOfMonth, ...userParams];
      const monthResult = await db.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE date >= $1${userClause.replace(`$${paramIndex - userParams.length}`, `$${userParams.length + 1}`)}`,
        monthParams,
      );
      const thisMonth = parseInt(monthResult.rows[0]?.count || 0);

      // This week
      const weekParams = [firstDayOfWeek, ...userParams];
      const weekResult = await db.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE date >= $1${userClause.replace(`$${paramIndex - userParams.length}`, `$${userParams.length + 1}`)}`,
        weekParams,
      );
      const thisWeek = parseInt(weekResult.rows[0]?.count || 0);

      // Today
      const todayParams = [today, ...userParams];
      const todayResult = await db.query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE date = $1${userClause.replace(`$${paramIndex - userParams.length}`, `$${userParams.length + 1}`)}`,
        todayParams,
      );
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
    } catch (error) {
      console.error(`[Model] Error in getStats for ${deptCode}:`, error);
      throw error;
    }
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

    // Filter metrics to only those with existing columns
    const validMetrics = metrics.filter((m) =>
      existingColumns.includes(m.field),
    );

    if (validMetrics.length === 0) {
      // No valid metrics, return empty result with just the groupBy
      const params = [];
      let paramIndex = 1;
      let query = `SELECT ${groupBy} FROM ${tableName} WHERE 1=1`;

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

      const result = await db.query(query, params);
      return result.rows;
    }

    // Build query only with valid metrics
    let query = `SELECT ${groupBy}, `;
    const aggregates = validMetrics
      .map((m) => {
        const calc = m.calculation || m.aggregation || "sum";
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
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Export data as CSV
   */
  static async exportData(deptCode, options = {}) {
    const { dateFrom, dateTo, userId } = options;
    const tableName = this.getTableName(deptCode);

    let query = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Handle user filter if provided
    if (userId && userId !== "undefined" && userId !== null) {
      const {
        clause,
        params: userParams,
        newParamIndex,
      } = await buildUserIdFilter(tableName, userId, paramIndex);
      if (clause) {
        query += clause;
        params.push(...userParams);
        paramIndex = newParamIndex;
      }
    }

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
