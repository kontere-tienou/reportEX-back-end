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
const reportService = require("../service/reportService");
const reportAccessRequestService = require("../service/reportAccessRequestService");
const { generateSnapshot } = require("../service/reportSnapshotService");

/**
 * ==========================================
 * REPORT CONTROLLER - COMPLETE
 * ==========================================
 */

const reportController = {
  async initializeBuilder(req, res) {
    try {
      // Send default components and layout configuration to initialize the builder
      res.status(200).json({
        message: "Report Builder Initialized",
        builderConfig: {
          components: ["chart", "table", "text"],
          defaultLayout: [],
        },
      });
    } catch (error) {
      console.error("Error initializing report builder:", error);
      res.status(500).json({ message: "Error initializing report builder" });
    }
  },

  async createReport(req, res) {
    try {
      const {
        period_start,
        period_end,
        layout,
        dateRange,
        visibility,
        title, // ← ADD THIS
      } = req.body;

      if (!period_start || !period_end) {
        return errorResponse(
          res,
          "Les dates de période sont obligatoires",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      if (!layout || !Array.isArray(layout)) {
        return errorResponse(
          res,
          "Le layout du rapport est invalide",
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

      // GENERATE SNAPSHOT
      const snapshot = await generateSnapshot(
        layout,
        req.user.department_id,
        dateRange,
      );

      const reportData = {
        title, 
        layout,
        renderedLayout: layout,
        sourceData: snapshot,
      };

      const report = await Report.create({
        user_id: req.user.id,
        department_id: req.user.department_id,
        period_start,
        period_end,
        layout: reportData,
        visibility: visibility || "private",
      });

      await AuditLog.create({
        user_id: req.user.id,
        action: "CREATE",
        entity_type: "report",
        entity_id: report.id,
        details: { period_start, period_end, visibility, title },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

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
      const user = req.user;
      const { status, search, visibility, department_id, page, limit } =
        req.query;

      const isDG = user?.role?.toUpperCase() === "DG";

      const filters = {
        status,
        search,
        page,
        limit,
      };

      if (isDG) {
        if (visibility) filters.visibility = visibility;
        if (department_id) filters.department_id = department_id;
      } else {
        filters.visibility = "public";
      }

      const reports = await reportService.getAllReports(filters, user);

      return res.status(200).json({
        success: true,
        data: {
          reports,
        },
      });
    } catch (error) {
      console.error("getAllReports error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Erreur lors du chargement des rapports",
      });
    }
  },

  async getReportDetails(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      // Charger le rapport avec les joins
      const report = await reportService.getReportDetails(id);

      // Vérifier l'accès via le service dédié
      const canRead = await reportAccessRequestService.canReadReport({
        reportId: id,
        user,
      });

      if (!canRead) {
        return res.status(403).json({
          success: false,
          message: "Accès restreint",
          data: {
            needsAccessRequest: true,
          },
        });
      }

      const role = String(user?.role || "").toUpperCase();
      const isDG = ["DG", "ADMIN"].includes(role);
      const isOwner = Number(report.user_id) === Number(user.id);

      const permissions = {
        canRead: true,
        canEdit: isOwner && ["brouillon", "rejete"].includes(report.status),
        canDelete: isOwner || isDG,
        canValidate: isDG && report.status === "soumis",
      };

      return res.status(200).json({
        success: true,
        data: {
          report,
          permissions,
        },
      });
    } catch (error) {
      console.error("getReportDetails error:", error);

      const status =
        error.statusCode ||
        error.status ||
        (error.name === "NotFoundError" ? 404 : null) ||
        (error.name === "ForbiddenError" ? 403 : null) ||
        500;

      return res.status(status).json({
        success: false,
        message: error.message || "Erreur lors du chargement du rapport",
      });
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
  
      return successResponse(
        res,
        { stats },
        "Department stats retrieved successfully"
      );
    } catch (error) {
      console.error("Error fetching department stats:", error);
      return errorResponse(
        res,
        "Error retrieving department stats",
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  },

  async saveTemplate(req, res) {
    const { layout, title, periodStart, periodEnd, departmentId, visibility } =
      req.body;

    if (!title || !periodStart || !periodEnd || !layout) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    try {
      // Create the custom report template
      const report = await Report.create({
        user_id: req.user.id,
        department_id: departmentId,
        period_start: periodStart,
        period_end: periodEnd,
        data: JSON.stringify({ layout }),
        visibility: visibility || "private",
      });

      // Update the report with layout information
      await Report.update(report.id, { layout: JSON.stringify(layout) });

      return res.status(201).json({
        message: "Template saved successfully",
        report,
      });
    } catch (error) {
      console.error("Error saving template:", error);
      return res.status(500).json({ message: "Error saving template" });
    }
  },

  /**
   * Generate the report (e.g., PDF generation)
   * POST /api/reports/generate
   */
  async generateReport(req, res) {
    const { layout, title, periodStart, periodEnd, departmentId, visibility } =
      req.body;

    if (!title || !periodStart || !periodEnd || !layout) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    try {
      // Create the report in the database
      const report = await Report.create({
        user_id: req.user.id,
        department_id: departmentId,
        period_start: periodStart,
        period_end: periodEnd,
        data: JSON.stringify({ layout }),
        visibility: visibility || "private", // Default to 'private'
      });

      // Implement report generation logic (e.g., generate PDF, handle layout)
      const pdfPath = await generatePdfReport(report); // This is a placeholder

      res
        .status(200)
        .json({ message: "Report generated successfully", pdfPath });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Error generating report" });
    }
  },
};

// PDF Generation Example (stub, you need to implement actual PDF generation)
async function generatePdfReport(report) {
  const pdfPath = `/path/to/generated/reports/${report.id}.pdf`;
  return pdfPath;
}


module.exports = reportController;
