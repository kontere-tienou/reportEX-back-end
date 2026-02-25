const ReportAccessRequestService = require("../service/reportAccessRequestService");
const {
  successResponse,
  errorResponse,
  createdResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * REPORT ACCESS REQUEST CONTROLLER
 * ==========================================
 */

const reportAccessRequestController = {
  /**
   * Request access to a report
   * POST /api/report-access/:reportId/request
   */
  async requestAccess(req, res) {
    try {
      const { reportId } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return errorResponse(
          res,
          "Veuillez indiquer la raison de votre demande",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const request = await ReportAccessRequestService.requestAccess(
        parseInt(reportId),
        req.user.id,
        reason.trim(),
      );

      return createdResponse(res, { request }, "Demande d'accès envoyée");
    } catch (error) {
      console.error("Request access error:", error);

      if (error.message.includes("déjà en attente")) {
        return errorResponse(res, error.message, HTTP_STATUS.CONFLICT);
      }

      return errorResponse(
        res,
        "Erreur lors de la demande d'accès",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Get pending access requests
   * GET /api/report-access/pending
   */
  async getPendingRequests(req, res) {
    try {
      const requests = await ReportAccessRequestService.getPendingRequests(
        req.user.id,
        req.user.role,
      );

      return successResponse(res, { requests }, "Demandes récupérées");
    } catch (error) {
      console.error("Get pending requests error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des demandes",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Approve access request
   * POST /api/report-access/:id/approve
   */
  async approveRequest(req, res) {
    try {
      const { id } = req.params;

      const request = await ReportAccessRequestService.approveRequest(
        parseInt(id),
        req.user.id,
      );

      return successResponse(res, { request }, "Accès accordé");
    } catch (error) {
      console.error("Approve request error:", error);

      if (error.message.includes("non trouvée")) {
        return errorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
      }

      return errorResponse(
        res,
        "Erreur lors de l'approbation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Reject access request
   * POST /api/report-access/:id/reject
   */
  async rejectRequest(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const request = await ReportAccessRequestService.rejectRequest(
        parseInt(id),
        req.user.id,
        reason?.trim() || null,
      );

      return successResponse(res, { request }, "Demande rejetée");
    } catch (error) {
      console.error("Reject request error:", error);

      if (error.message.includes("non trouvée")) {
        return errorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
      }

      return errorResponse(
        res,
        "Erreur lors du rejet",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = reportAccessRequestController;
