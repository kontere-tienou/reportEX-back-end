// controllers/departmentDataController.js
const departmentDataService = require("../service/departmentDataService"); // Check the path!
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * DEPARTMENT DATA CONTROLLER
 * ==========================================
 */

const departmentDataController = {
  /**
   * Get all data for a department
   * GET /api/:deptCode/data
   */
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

  /**
   * Get single data entry
   * GET /api/:deptCode/data/:id
   */
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

  /**
   * Create new data entry
   * POST /api/:deptCode/data
   */
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

  /**
   * Update data entry
   * PUT /api/:deptCode/data/:id
   */
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

  /**
   * Delete data entry
   * DELETE /api/:deptCode/data/:id
   */
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

  /**
   * Get statistics
   * GET /api/:deptCode/data/stats
   */
  async getStats(req, res) {
    try {
      const { deptCode } = req.params;
      const userId = req.user?.role === "DG" ? null : req.userId;

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

  /**
   * Get aggregated data
   * GET /api/:deptCode/data/aggregated
   */
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

      return successResponse(
        res,
        aggregated,
        "Données agrégées récupérées",
      );
    } catch (error) {
      console.error("Get aggregated error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de l'agrégation",
        error.status || HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Export data
   * GET /api/:deptCode/data/export
   */
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
};

module.exports = departmentDataController;
