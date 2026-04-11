// controllers/reportAccessController.js
const db = require("../config/database");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");

const reportAccessController = {
  // Demander l'accès à un rapport (tout utilisateur)
  async requestAccess(req, res) {
    try {
      const { reportId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      if (!reason || !reason.trim()) {
        return errorResponse(
          res,
          "La raison est obligatoire",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Vérifier si une demande existe déjà
      const existing = await db.query(
        `SELECT * FROM report_access_requests 
                 WHERE report_id = $1 AND user_id = $2 AND status = 'pending'`,
        [reportId, userId],
      );

      if (existing.rows.length > 0) {
        return errorResponse(
          res,
          "Vous avez déjà une demande en attente",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Créer la demande
      const result = await db.query(
        `INSERT INTO report_access_requests (report_id, user_id, reason, status, created_at)
                 VALUES ($1, $2, $3, 'pending', NOW())
                 RETURNING *`,
        [reportId, userId, reason],
      );

      return successResponse(
        res,
        { request: result.rows[0] },
        "Demande envoyée",
      );
    } catch (error) {
      console.error("requestAccess error:", error);
      return errorResponse(
        res,
        "Erreur lors de la demande",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Récupérer mes demandes (tout utilisateur)
  async getMyRequests(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `SELECT rar.*, r.title as report_title, r.department_id, d.name as department_name
                 FROM report_access_requests rar
                 JOIN reports r ON rar.report_id = r.id
                 LEFT JOIN departments d ON r.department_id = d.id
                 WHERE rar.user_id = $1
                 ORDER BY rar.created_at DESC`,
        [userId],
      );

      return successResponse(
        res,
        { requests: result.rows },
        "Demandes récupérées",
      );
    } catch (error) {
      console.error("getMyRequests error:", error);
      return errorResponse(
        res,
        "Erreur de récupération",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Annuler ma demande (tout utilisateur)
  async cancelRequest(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await db.query(
        `UPDATE report_access_requests 
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE id = $1 AND user_id = $2 AND status = 'pending'
                 RETURNING *`,
        [id, userId],
      );

      if (result.rows.length === 0) {
        return errorResponse(
          res,
          "Demande non trouvée ou déjà traitée",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return successResponse(res, null, "Demande annulée");
    } catch (error) {
      console.error("cancelRequest error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'annulation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Vérifier si j'ai accès à un rapport (tout utilisateur)
  async checkAccess(req, res) {
    try {
      const { reportId } = req.params;
      const userId = req.user.id;

      // Vérifier si l'utilisateur a un accès approuvé
      const result = await db.query(
        `SELECT * FROM report_access_requests 
                 WHERE report_id = $1 AND user_id = $2 AND status = 'approved'
                 LIMIT 1`,
        [reportId, userId],
      );

      const hasAccess = result.rows.length > 0;

      return successResponse(res, { hasAccess }, "Vérification effectuée");
    } catch (error) {
      console.error("checkAccess error:", error);
      return errorResponse(
        res,
        "Erreur de vérification",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Récupérer les demandes en attente (DG/ADMIN seulement)
  async getPendingRequests(req, res) {
    try {
      const result = await db.query(
        `SELECT rar.*, 
                        u.first_name || ' ' || u.last_name as user_name,
                        u.email as user_email,
                        r.title as report_title,
                        r.department_id,
                        d.name as department_name
                 FROM report_access_requests rar
                 JOIN users u ON rar.user_id = u.id
                 JOIN reports r ON rar.report_id = r.id
                 LEFT JOIN departments d ON r.department_id = d.id
                 WHERE rar.status = 'pending'
                 ORDER BY rar.created_at ASC`,
      );

      return successResponse(
        res,
        { requests: result.rows },
        "Demandes en attente",
      );
    } catch (error) {
      console.error("getPendingRequests error:", error);
      return errorResponse(
        res,
        "Erreur de récupération",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Approuver une demande (DG/ADMIN seulement)
  async approveAccess(req, res) {
    try {
      const { id } = req.params;
      const approverId = req.user.id;

      const result = await db.query(
        `UPDATE report_access_requests 
                 SET status = 'approved', 
                     approved_by = $1, 
                     approved_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $2 AND status = 'pending'
                 RETURNING *`,
        [approverId, id],
      );

      if (result.rows.length === 0) {
        return errorResponse(
          res,
          "Demande non trouvée ou déjà traitée",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // Optionnel: créer une notification pour l'utilisateur
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, 'access_granted', 'Accès accordé', 
                         'Votre demande d\\'accès au rapport a été approuvée', 
                         $2)`,
        [result.rows[0].user_id, `/reports/${result.rows[0].report_id}`],
      );

      return successResponse(
        res,
        { request: result.rows[0] },
        "Demande approuvée",
      );
    } catch (error) {
      console.error("approveAccess error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'approbation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Rejeter une demande (DG/ADMIN seulement)
  async rejectAccess(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const approverId = req.user.id;

      if (!reason || !reason.trim()) {
        return errorResponse(
          res,
          "La raison du rejet est obligatoire",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const result = await db.query(
        `UPDATE report_access_requests 
                 SET status = 'rejected', 
                     approved_by = $1, 
                     rejection_reason = $2,
                     approved_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $3 AND status = 'pending'
                 RETURNING *`,
        [approverId, reason, id],
      );

      if (result.rows.length === 0) {
        return errorResponse(
          res,
          "Demande non trouvée ou déjà traitée",
          HTTP_STATUS.NOT_FOUND,
        );
      }

      // Optionnel: créer une notification pour l'utilisateur
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
                 VALUES ($1, 'access_denied', 'Accès refusé', 
                         'Votre demande d\\'accès au rapport a été refusée: ' || $2, 
                         $3)`,
        [
          result.rows[0].user_id,
          reason,
          `/reports/${result.rows[0].report_id}`,
        ],
      );

      return successResponse(
        res,
        { request: result.rows[0] },
        "Demande rejetée",
      );
    } catch (error) {
      console.error("rejectAccess error:", error);
      return errorResponse(
        res,
        "Erreur lors du rejet",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  // Récupérer les demandes pour un rapport spécifique
  async getRequestsByReport(req, res) {
    try {
      const { reportId } = req.params;
      const userId = req.user.id;
      const role = req.user.role;

      // Vérifier si l'utilisateur est autorisé à voir ces demandes
      // (propriétaire du rapport ou DG/ADMIN)
      const reportCheck = await db.query(
        `SELECT user_id FROM reports WHERE id = $1`,
        [reportId],
      );

      if (reportCheck.rows.length === 0) {
        return notFoundResponse(res, "Rapport non trouvé");
      }

      const isOwner = reportCheck.rows[0].user_id === userId;
      const isDG = ["DG", "ADMIN"].includes(role?.toUpperCase());

      if (!isOwner && !isDG) {
        return errorResponse(res, "Non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const result = await db.query(
        `SELECT rar.*, 
                        u.first_name || ' ' || u.last_name as user_name,
                        u.email as user_email
                 FROM report_access_requests rar
                 JOIN users u ON rar.user_id = u.id
                 WHERE rar.report_id = $1
                 ORDER BY rar.created_at DESC`,
        [reportId],
      );

      return successResponse(
        res,
        { requests: result.rows },
        "Demandes récupérées",
      );
    } catch (error) {
      console.error("getRequestsByReport error:", error);
      return errorResponse(
        res,
        "Erreur de récupération",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = reportAccessController;
