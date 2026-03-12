// controllers/departmentDataController.js
const departmentDataService = require("../service/departmentDataService"); 
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");
const db = require("../config/database");

/**
 * ==========================================
 * DEPARTMENT DATA CONTROLLER
 * ==========================================
 */

const departmentDataController = {
 
  
  async getAll(req, res) {
    try {
      const { deptCode } = req.params;
      const { page, limit, dateFrom, dateTo, sortBy, sortOrder } = req.query;
      const userId = req.user?.role === "DG" ? null : req.userId;

      console.log("Getting data for department:", deptCode);
      console.log("User ID:", userId);

      const result = await departmentDataService.getAll(
        deptCode,
        {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder,
        },
        userId,
      );

      return paginatedResponse(
        res,
        result.data,
        result.pagination,
        "Données récupérées avec succès",
      );
    } catch (error) {
      console.error("Get all data error DETAILED:", error);
      console.error("Error stack:", error.stack);
      return errorResponse(
        res,
        error.message || "Erreur lors de la récupération des données",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
  async getOne(req, res) {
    try {
      const { deptCode, id } = req.params;

      if (!isUuid(id)) {
        return errorResponse(res, "ID invalide", 400);
      }

      const data = await departmentDataService.getById(deptCode, id);

      if (!data) {
        return notFoundResponse(res, "Donnée non trouvée");
      }

      return successResponse(res, { data }, "Donnée récupérée avec succès");
    } catch (error) {
      console.error("Get data error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de la récupération",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async create(req, res) {
    try {
      const { deptCode } = req.params;
      const data = req.body;
      const userId = req.userId;

      console.log("Creating data for department:", deptCode);
      console.log("User ID:", userId);
      console.log("Data:", data);

      // Validate required fields
      if (!data.date) {
        return errorResponse(
          res,
          "La date est requise",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const newData = await departmentDataService.create(
        deptCode,
        data,
        userId,
      );

      return createdResponse(
        res,
        { data: newData },
        "Données créées avec succès",
      );
    } catch (error) {
      console.error("Create data error:", error);
      console.error("Error stack:", error.stack);
      return errorResponse(
        res,
        error.message || "Erreur lors de la création",
        error.status || HTTP_STATUS.BAD_REQUEST,
      );
    }
  },
  async update(req, res) {
    try {
      const { deptCode, id } = req.params;
      const data = req.body;
      const userId = req.userId;

      console.log("Updating data:", id, "for department:", deptCode);

      const updated = await departmentDataService.update(
        deptCode,
        id,
        data,
        userId,
      );

      if (!updated) {
        return notFoundResponse(res, "Donnée non trouvée");
      }

      return successResponse(
        res,
        { data: updated },
        "Données mises à jour avec succès",
      );
    } catch (error) {
      console.error("Update data error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de la mise à jour",
        error.status || HTTP_STATUS.BAD_REQUEST,
      );
    }
  },

  async delete(req, res) {
    try {
      const { deptCode, id } = req.params;
      const userId = req.userId;

      console.log("Deleting data:", id, "for department:", deptCode);

      const deleted = await departmentDataService.delete(deptCode, id, userId);

      if (!deleted) {
        return notFoundResponse(res, "Donnée non trouvée");
      }

      return successResponse(res, null, "Données supprimées avec succès");
    } catch (error) {
      console.error("Delete data error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de la suppression",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getStats(req, res) {
    try {
      const { deptCode } = req.params;
      const userId = req.user?.role? null : req.userId;

      console.log("Getting stats for department:", deptCode);
      console.log("User ID:", userId);

      const stats = await departmentDataService.getStats(deptCode, userId);

      return successResponse(res, stats, "Statistiques récupérées avec succès");
    } catch (error) {
      console.error("Get stats error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de la récupération des statistiques",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getAggregated(req, res) {
    try {
      const { deptCode } = req.params;
      const { dateFrom, dateTo, groupBy, metrics } = req.query;

      const aggregated = await departmentDataService.getAggregated(deptCode, {
        dateFrom,
        dateTo,
        groupBy,
        metrics: metrics ? JSON.parse(metrics) : [],
      });

      return successResponse(res, aggregated, "Données agrégées récupérées");
    } catch (error) {
      console.error("Get aggregated error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de l'agrégation",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async exportData(req, res) {
    try {
      const { deptCode } = req.params;
      const { dateFrom, dateTo, format = "csv" } = req.query;

      const data = await departmentDataService.exportData(deptCode, {
        dateFrom,
        dateTo,
      });

      if (format === "csv") {
        const csv = departmentDataService.generateCSV(data);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${deptCode}_data_${Date.now()}.csv"`,
        );
        return res.send(csv);
      }

      return successResponse(res, { data }, "Export réussi");
    } catch (error) {
      console.error("Export error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de l'export",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
  async getBatchData(req, res) {
    const { deptCode } = req.params;
    const { metrics, dateFrom, dateTo, groupBy } = req.body;
    const userId = req.user.id;
    console.log("User ID type:", typeof userId);
    console.log("User ID value:", userId);
    const isAdmin = ["DG", "ADMIN"].includes(req.user.role?.toUpperCase());

    try {
      // Validate input
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return errorResponse(
          res,
          "Metrics array is required",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const tableName = `${deptCode.toLowerCase()}_data`;

      // Check if table exists
      const tableCheck = await db.query(
        `SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_name = $1
              )`,
        [tableName],
      );

      if (!tableCheck.rows[0].exists) {
        return errorResponse(
          res,
          `Table ${tableName} does not exist`,
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // Build SELECT clause with all metrics
      const metricSelects = metrics
        .map((m) => {
          // Sanitize field name
          const field = m.field.replace(/[^a-zA-Z0-9_]/g, "");

          switch (m.calculation) {
            case "sum":
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
            case "avg":
              return `COALESCE(AVG(${field}), 0) as "${field}_avg"`;
            case "max":
              return `COALESCE(MAX(${field}), 0) as "${field}_max"`;
            case "min":
              return `COALESCE(MIN(${field}), 0) as "${field}_min"`;
            case "count":
              return `COUNT(${field}) as "${field}_count"`;
            default:
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
          }
        })
        .join(", ");

      // Build WHERE clause
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`date >= $${paramIndex++}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`date <= $${paramIndex++}`);
        params.push(dateTo);
      }

      // Add user filter if not admin
      if (!isAdmin) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(userId);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Add GROUP BY if needed
      let groupByClause = "";
      if (groupBy) {
        const safeGroupBy = groupBy.replace(/[^a-zA-Z0-9_]/g, "");
        groupByClause = `GROUP BY ${safeGroupBy}`;
      }

      // Execute query
      const query = `
              SELECT 
                  ${groupBy ? `${groupBy}, ` : ""}
                  ${metricSelects}
              FROM ${tableName}
              ${whereClause}
              ${groupByClause}
              ${!groupBy ? "LIMIT 1" : ""}
          `;

      console.log("Batch query:", query);
      console.log("Params:", params);

      const result = await db.query(query, params);

      // Format response based on whether grouped or not
      if (groupBy) {
        const groupedResults = {};
        result.rows.forEach((row) => {
          const key = row[groupBy];
          groupedResults[key] = row;
        });
        return successResponse(res, groupedResults, "Batch data retrieved");
      } else {
        return successResponse(
          res,
          result.rows[0] || {},
          "Batch data retrieved",
        );
      }
    } catch (error) {
      console.error("Get batch data error:", error);
      return errorResponse(
        res,
        "Error retrieving batch data: " + error.message,
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getBatchChartData(req, res) {
    const { deptCode } = req.params;
    const { metrics, dateFrom, dateTo, groupBy = "date" } = req.body;
    const userId = req.user.id;
    const isAdmin = ["DG", "ADMIN"].includes(req.user.role?.toUpperCase());
  
    try {
      const tableName = `${deptCode.toLowerCase()}_data`;
  
      // 1) Get real columns from DB
      const columnsResult = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = $1`,
        [tableName]
      );
  
      const existingColumns = columnsResult.rows.map((row) => row.column_name);
  
      // 2) Keep only valid metrics
      const validMetrics = (metrics || []).filter((m) =>
        existingColumns.includes(m.field)
      );
  
      if (validMetrics.length === 0) {
        return successResponse(res, [], "Aucune métrique valide trouvée");
      }
  
      // 3) Sanitize groupBy too
      const safeGroupBy = existingColumns.includes(groupBy) ? groupBy : "date";
  
      // 4) Build SELECT
      const metricSelects = validMetrics
        .map((m) => {
          const field = m.field;
          const agg = m.aggregation || "sum";
  
          switch (agg) {
            case "sum":
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
            case "avg":
              return `COALESCE(AVG(${field}), 0) as "${field}_avg"`;
            case "max":
              return `COALESCE(MAX(${field}), 0) as "${field}_max"`;
            case "min":
              return `COALESCE(MIN(${field}), 0) as "${field}_min"`;
            default:
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
          }
        })
        .join(", ");
  
      const conditions = [];
      const params = [];
      let paramIndex = 1;
  
      if (dateFrom) {
        conditions.push(`date >= $${paramIndex++}`);
        params.push(dateFrom);
      }
  
      if (dateTo) {
        conditions.push(`date <= $${paramIndex++}`);
        params.push(dateTo);
      }
  
      if (!isAdmin) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(userId);
      }
  
      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  
      const query = `
        SELECT
          ${safeGroupBy},
          ${metricSelects}
        FROM ${tableName}
        ${whereClause}
        GROUP BY ${safeGroupBy}
        ORDER BY ${safeGroupBy} ASC
      `;
  
      console.log("Batch chart query:", query);
      console.log("Params:", params);
  
      const result = await db.query(query, params);
  
      const chartData = result.rows.map((row) => {
        const dataPoint = { [safeGroupBy]: row[safeGroupBy] };
  
        validMetrics.forEach((m) => {
          const field = m.field;
          const agg = m.aggregation || "sum";
          dataPoint[field] = row[`${field}_${agg}`] || 0;
        });
  
        return dataPoint;
      });
  
      return successResponse(res, chartData, "Batch chart data retrieved");
    } catch (error) {
      console.error("Get batch chart data error:", error);
      return errorResponse(
        res,
        "Error retrieving batch chart data: " + error.message,
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  },
 /*
  async getBatchChartData(req, res) {
    const { deptCode } = req.params;
    const { metrics, dateFrom, dateTo, groupBy = "date" } = req.body;
    const userId = req.user.id;
    const isAdmin = ["DG", "ADMIN"].includes(req.user.role?.toUpperCase());

    try {
      const tableName = `${deptCode.toLowerCase()}_data`;

      // Build SELECT for multiple metrics
      const metricSelects = metrics
        .map((m) => {
          const field = m.field.replace(/[^a-zA-Z0-9_]/g, "");
          const agg = m.aggregation || "sum";

          switch (agg) {
            case "sum":
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
            case "avg":
              return `COALESCE(AVG(${field}), 0) as "${field}_avg"`;
            case "max":
              return `COALESCE(MAX(${field}), 0) as "${field}_max"`;
            case "min":
              return `COALESCE(MIN(${field}), 0) as "${field}_min"`;
            default:
              return `COALESCE(SUM(${field}), 0) as "${field}_sum"`;
          }
        })
        .join(", ");

      // Build WHERE clause
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (dateFrom) {
        conditions.push(`date >= $${paramIndex++}`);
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`date <= $${paramIndex++}`);
        params.push(dateTo);
      }

      // Add user filter if not admin
      if (!isAdmin) {
        conditions.push(`user_id = $${paramIndex++}`);
        params.push(userId);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
              SELECT 
                  ${groupBy},
                  ${metricSelects}
              FROM ${tableName}
              ${whereClause}
              GROUP BY ${groupBy}
              ORDER BY ${groupBy} ASC
          `;

      console.log("Batch chart query:", query);
      console.log("Params:", params);

      const result = await db.query(query, params);

      // Transform to chart-friendly format
      const chartData = result.rows.map((row) => {
        const dataPoint = { [groupBy]: row[groupBy] };

        metrics.forEach((m) => {
          const field = m.field;
          const agg = m.aggregation || "sum";
          dataPoint[field] = row[`${field}_${agg}`] || 0;
        });

        return dataPoint;
      });

      return successResponse(res, chartData, "Batch chart data retrieved");
    } catch (error) {
      console.error("Get batch chart data error:", error);
      return errorResponse(
        res,
        "Error retrieving batch chart data: " + error.message,
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },*/

  async getPieData(req, res) {
    try {
      const { deptCode } = req.params;
      const { fields, dateFrom, dateTo } = req.body;
  
      const table = `${deptCode.toLowerCase()}_data`;
  
      const result = await db.query(
        `
        SELECT ${fields[0]} AS name,
               COUNT(*) AS value
        FROM ${table}
        WHERE date BETWEEN $1 AND $2
        GROUP BY ${fields[0]}
        ORDER BY value DESC
        `,
        [dateFrom, dateTo]
      );
  
      res.json({
        success: true,
        data: result.rows
      });
  
    } catch (error) {
      console.error("Pie chart error:", error);
      res.status(500).json({
        success: false,
        message: "Erreur récupération données pie chart"
      });
    }
  },
  async getBatchStats(req, res) {
    const { departments } = req.body;
    const userId = req.user.id;
    console.log("User ID type:", typeof userId);
    console.log("User ID value:", userId);
   // const isAdmin = ["DG", "ADMIN"].includes(req.user.role?.toUpperCase());

    try {
      if (!departments || !Array.isArray(departments)) {
        return errorResponse(
          res,
          "Departments array is required",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const statsPromises = departments.map(async (deptCode) => {
        const tableName = `${deptCode.toLowerCase()}_data`;

        // Check if table exists
        const tableCheck = await db.query(
          `SELECT EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_name = $1
                  )`,
          [tableName],
        );

        if (!tableCheck.rows[0].exists) {
          return {
            department: deptCode,
            exists: false,
            total_records: 0,
            avg_ca: 0,
            total_ca: 0,
          };
        }

        // Get basic stats
        const userCondition = !isAdmin ? "AND user_id = $1" : "";
        const statsQuery = `
                  SELECT 
                      COUNT(*) as total_records,
                      COALESCE(AVG(ca), 0) as avg_ca,
                      COALESCE(SUM(ca), 0) as total_ca,
                      MIN(date) as first_record,
                      MAX(date) as last_record
                  FROM ${tableName}
                  WHERE 1=1 ${userCondition}
              `;

        const params = !isAdmin ? [userId] : [];
        const result = await db.query(statsQuery, params);

        return {
          department: deptCode,
          exists: true,
          ...result.rows[0],
        };
      });

      const results = await Promise.all(statsPromises);

      return successResponse(res, results, "Batch stats retrieved");
    } catch (error) {
      console.error("Get batch stats error:", error);
      return errorResponse(
        res,
        "Error retrieving batch stats: " + error.message,
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = departmentDataController;
