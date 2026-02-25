const Report = require("../models/reportModel");
const AuditLog = require("../models/AuditLog");
const {
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
} = require("../utils/responseFormatter");
const { HTTP_STATUS } = require("../config/constants");
const db = require("../config/database");

/**
 * ==========================================
 * REPORT CONTROLLER - COMPLETE
 * ==========================================
 */

const reportController = {
  /**
   * Create new report
   * POST /api/reports
   */
  async createReport(req, res) {
    try {
      const { period_start, period_end, data, visibility } = req.body;

      // Validation
      if (!period_start || !period_end) {
        return errorResponse(
          res,
          "Les dates de période sont obligatoires",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      if (!data || typeof data !== "object") {
        return errorResponse(
          res,
          "Les données du rapport sont invalides",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      if (new Date(period_start) > new Date(period_end)) {
        return errorResponse(
          res,
          "La date de début doit être avant la date de fin",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Check duplicate period
      const existing = await db.query(
        `SELECT id FROM reports
         WHERE department_id = $1
         AND period_start = $2
         AND period_end = $3
         AND status != 'rejete'`,
        [req.user.department_id, period_start, period_end],
      );

      if (existing.rowCount > 0) {
        return errorResponse(
          res,
          "Un rapport existe déjà pour cette période",
          HTTP_STATUS.CONFLICT,
        );
      }

      // Create report
      const report = await Report.create({
        user_id: req.user.id,
        department_id: req.user.department_id,
        period_start,
        period_end,
        data,
        visibility: visibility || "private",
      });

      // Audit log
      await AuditLog.create({
        user_id: req.user.id,
        action: "CREATE",
        entity_type: "report",
        entity_id: report.id,
        details: { period_start, period_end, visibility },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      // Notify DG
      const io = req.app.get("io");
      if (io) {
        const dgUsers = await db.query(
          `SELECT id FROM users WHERE role IN ('DG', 'ADMIN') AND is_active = true`,
        );

        for (const dg of dgUsers.rows) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              dg.id,
              "report_created",
              "Nouveau rapport créé",
              `${req.user.full_name} a créé un nouveau rapport`,
              `/reports/${report.id}`,
            ],
          );

          io.to(`user:${dg.id}`).emit("notification", {
            type: "report_created",
            message: `Nouveau rapport de ${req.user.full_name}`,
          });
        }
      }

      return createdResponse(res, { report }, "Rapport créé avec succès");
    } catch (error) {
      console.error("Create report error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getMyReports(req, res) {
    try {
      const { page, limit, status, search } = req.query;

      const result = await Report.findAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        user_id: req.user.id,
        status,
        search,
      });

      return successResponse(res, result, "Rapports récupérés");
    } catch (error) {
      console.error("Get my reports error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des rapports",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getAllReports(req, res) {
    try {
      const { page, limit, department_id, status, search } = req.query;

      const result = await Report.findAll({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        department_id,
        status,
        search,
      });

      return successResponse(res, result, "Rapports récupérés");
    } catch (error) {
      console.error("Get all reports error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des rapports",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getReportDetails(req, res) {
    try {
      const { id } = req.params;

      const report = await Report.findById(id);

      if (!report) {
        return notFoundResponse(res, "Rapport non trouvé");
      }

      // Get permissions
      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN, {
          needsAccessRequest: permissions.needsAccessRequest,
        });
      }

      // Get validations
      const validations = await Report.getValidations(id);

      // Get annotations
      const annotations = await Report.getAnnotations(id);

      // Parse data
      let parsedData = report.data;
      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (e) {
          parsedData = { contenu_brut: parsedData };
        }
      }

      return successResponse(
        res,
        {
          report: {
            ...report,
            data: parsedData,
            validations,
            annotations,
          },
          permissions,
        },
        "Rapport récupéré",
      );
    } catch (error) {
      console.error("Get report details error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

 
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const { data } = req.body;

      const report = await Report.findById(id);

      if (!report) {
        return notFoundResponse(res, "Rapport non trouvé");
      }

      if (report.user_id !== req.user.id) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      if (!["brouillon", "rejete"].includes(report.status)) {
        return errorResponse(
          res,
          "Impossible de modifier ce rapport",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const updated = await Report.update(id, { data });

      // Audit log
      await AuditLog.create({
        user_id: req.user.id,
        action: "UPDATE",
        entity_type: "report",
        entity_id: id,
        details: { data },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, { report: updated }, "Rapport mis à jour");
    } catch (error) {
      console.error("Update report error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

 
  async submitReport(req, res) {
    try {
      const { id } = req.params;

      const report = await Report.submit(id, req.user.id);

      if (!report) {
        return errorResponse(
          res,
          "Rapport non trouvé ou déjà soumis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Audit log
      await AuditLog.create({
        user_id: req.user.id,
        action: "SUBMIT",
        entity_type: "report",
        entity_id: id,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      // Notify DG
      const io = req.app.get("io");
      if (io) {
        const dgUsers = await db.query(
          `SELECT id FROM users WHERE role IN ('DG', 'ADMIN') AND is_active = true`,
        );

        for (const dg of dgUsers.rows) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              dg.id,
              "report_submitted",
              "Rapport soumis pour validation",
              `${req.user.full_name} a soumis un rapport`,
              `/reports/${id}`,
            ],
          );
        }
      }

      return successResponse(res, { report }, "Rapport soumis pour validation");
    } catch (error) {
      console.error("Submit report error:", error);
      return errorResponse(
        res,
        "Erreur lors de la soumission du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async validateReport(req, res) {
    try {
      const { id } = req.params;
      const { status, comments } = req.body;

      if (!["valide", "rejete"].includes(status)) {
        return errorResponse(res, "Statut invalide", HTTP_STATUS.BAD_REQUEST);
      }

      if (status === "rejete" && !comments) {
        return errorResponse(
          res,
          "Les commentaires sont requis pour un rejet",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const report = await Report.validate(id, req.user.id, {
        status,
        comments,
      });

      if (!report) {
        return errorResponse(
          res,
          "Rapport non trouvé ou déjà traité",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Audit log
      await AuditLog.create({
        user_id: req.user.id,
        action: "VALIDATE",
        entity_type: "report",
        entity_id: id,
        details: { status, comments },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      // Notify author
      const io = req.app.get("io");
      if (io) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            report.user_id,
            `report_${status}`,
            status === "valide" ? "Rapport validé" : "Rapport rejeté",
            status === "valide"
              ? "Votre rapport a été validé"
              : `Votre rapport a été rejeté: ${comments}`,
            `/reports/${id}`,
          ],
        );

        io.to(`user:${report.user_id}`).emit("notification", {
          type: `report_${status}`,
          message: status === "valide" ? "Rapport validé" : "Rapport rejeté",
        });
      }

      return successResponse(
        res,
        { report },
        status === "valide" ? "Rapport validé" : "Rapport rejeté",
      );
    } catch (error) {
      console.error("Validate report error:", error);
      return errorResponse(
        res,
        "Erreur lors de la validation du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async deleteReport(req, res) {
    try {
      const { id } = req.params;

      const report = await Report.delete(id, req.user.id);

      if (!report) {
        return errorResponse(
          res,
          "Rapport non trouvé ou impossible à supprimer",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      // Audit log
      await AuditLog.create({
        user_id: req.user.id,
        action: "DELETE",
        entity_type: "report",
        entity_id: id,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Rapport supprimé");
    } catch (error) {
      console.error("Delete report error:", error);
      return errorResponse(
        res,
        "Erreur lors de la suppression du rapport",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  /**
   * Add comment
   * POST /api/reports/:id/comments
   */
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { content, comment } = req.body;

      const finalContent = content || comment;

      if (!finalContent || !finalContent.trim()) {
        return errorResponse(
          res,
          "Le commentaire ne peut pas être vide",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      const newComment = await Report.addComment(
        id,
        req.user.id,
        finalContent.trim(),
      );

      return createdResponse(
        res,
        { comment: { ...newComment, content: finalContent.trim() } },
        "Commentaire ajouté",
      );
    } catch (error) {
      console.error("Add comment error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'ajout du commentaire",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getComments(req, res) {
    try {
      const { id } = req.params;

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      const comments = await Report.getComments(id);

      // Transform comment field to content for frontend compatibility
      const transformedComments = comments.map((c) => ({
        ...c,
        content: c.comment || c.content,
      }));

      return successResponse(
        res,
        { comments: transformedComments },
        "Commentaires récupérés",
      );
    } catch (error) {
      console.error("Get comments error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des commentaires",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },


  async markAsRead(req, res) {
    try {
      const { id } = req.params;

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      await Report.markAsRead(id, req.user.id);

      return successResponse(res, null, "Marqué comme lu");
    } catch (error) {
      console.error("Mark as read error:", error);
      return errorResponse(
        res,
        "Erreur lors du marquage",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getReaders(req, res) {
    try {
      const { id } = req.params;

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      const readers = await Report.getReaders(id);

      return successResponse(res, { readers }, "Lecteurs récupérés");
    } catch (error) {
      console.error("Get readers error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des lecteurs",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },


  async addAnnotation(req, res) {
    try {
      const { id } = req.params;
      const { selected_text, comment, decision, range_meta } = req.body;

      if (!selected_text || !selected_text.trim()) {
        return errorResponse(
          res,
          "Le texte sélectionné est requis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canAnnotate) {
        return errorResponse(
          res,
          "Vous n'avez pas la permission d'annoter",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const annotation = await Report.addAnnotation(id, req.user.id, {
        selected_text: selected_text.trim(),
        comment: comment?.trim() || null,
        decision,
        range_meta,
      });

      return createdResponse(res, { annotation }, "Annotation ajoutée");
    } catch (error) {
      console.error("Add annotation error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'ajout de l'annotation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },


  async getDepartmentStats(req, res) {
    try {
      const { departmentId } = req.params;

      const stats = await Report.getDepartmentStats(departmentId);

      return successResponse(res, { stats }, "Statistiques récupérées");
    } catch (error) {
      console.error("Get stats error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération des statistiques",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async exportPdf(req, res) {
    try {
      const { id } = req.params;

      const permissions = await Report.getPermissions(id, req.user);

      if (!permissions.canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      const report = await Report.findById(id);

      // TODO: Implement PDF generation
      // For now, return not implemented
      return errorResponse(
        res,
        "Export PDF non implémenté",
        HTTP_STATUS.NOT_IMPLEMENTED,
      );
    } catch (error) {
      console.error("Export PDF error:", error);
      return errorResponse(
        res,
        "Erreur lors de l'export PDF",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },
};

module.exports = reportController;
