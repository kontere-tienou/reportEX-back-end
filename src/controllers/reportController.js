const Report = require("../models/reportModel");
const AuditLog = require("../models/AuditLog");
const PDFDocument = require("pdfkit");
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

const normalizeRole = (user) =>
  String(user?.role || user?.role_code || "").toUpperCase();

function buildReportPermissions(user, report) {
  const userId = Number(user?.id);
  const userDepartmentId = Number(user?.department_id || user?.department?.id);
  const reportDepartmentId = Number(report?.department_id);
  const role = normalizeRole(user);

  const isDG = ["DG", "ADMIN"].includes(role);
  const isOwner = Number(report?.user_id) === userId;
  const isSameDepartment = reportDepartmentId === userDepartmentId;

  const permissions = {
    canRead: false,
    canEdit: false,
    canDelete: false,
    canSubmit: false,
    canValidate: false,
    canRequestAccess: false,
  };

  if (isDG) {
    permissions.canRead = true;
    permissions.canValidate = report.status === "soumis";
    return permissions;
  }

  if (isOwner) {
    permissions.canRead = true;
    permissions.canEdit = ["brouillon", "rejete"].includes(report.status);
    permissions.canDelete = ["brouillon", "rejete"].includes(report.status);
    permissions.canSubmit = report.status === "brouillon";
    return permissions;
  }

  if (isSameDepartment) {
    permissions.canRead = true;
    return permissions;
  }
  permissions.canRequestAccess = true;
  return permissions;
}

/**
 * Helper: Vérifier l'accès au département via departmentCode
 */
const checkDepartmentAccessByCode = async (user, departmentCode) => {
  console.log(`=== checkDepartmentAccessByCode ===`);
  console.log(`User:`, {
    id: user?.id,
    role: user?.role,
    department_id: user?.department_id,
  });
  console.log(`Target department code: ${departmentCode}`);

  if (!user || !departmentCode) {
    console.log(`Access denied: missing user or departmentCode`);
    return false;
  }

  const role = normalizeRole(user);
  console.log(`Normalized role: ${role}`);

  // DG/ADMIN ont accès à tout
  if (["DG", "ADMIN"].includes(role)) {
    console.log(`Access granted: user is ${role}`);
    return true;
  }

  try {
    // Récupérer l'utilisateur avec son département
    const userResult = await db.query(
      `SELECT u.*, d.code as department_code, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [user.id],
    );

    console.log(`User query result:`, userResult.rows[0]);

    if (userResult.rows.length === 0) {
      console.log(`Access denied: user not found`);
      return false;
    }

    const userDepartmentCode = userResult.rows[0]?.department_code;
    console.log(`User department code: ${userDepartmentCode}`);
    console.log(
      `Comparing: "${userDepartmentCode}" === "${departmentCode}" ? ${userDepartmentCode === departmentCode}`,
    );

    // Vérifier si le code correspond (insensible à la casse)
    const hasAccess =
      userDepartmentCode?.toLowerCase() === departmentCode?.toLowerCase();
    console.log(`Final access result: ${hasAccess}`);

    return hasAccess;
  } catch (error) {
    console.error("Error checking department access:", error);
    return false;
  }
};

/**
 * Helper: Récupérer department_id à partir du code
 */
const getDepartmentIdFromCode = async (departmentCode) => {
  if (!departmentCode) return null;

  try {
    const result = await db.query(
      `SELECT id FROM departments WHERE code = $1 OR LOWER(code) = LOWER($1)`,
      [departmentCode],
    );
    return result.rows[0]?.id || null;
  } catch (error) {
    console.error("Error getting department ID:", error);
    return null;
  }
};

/**
 * Helper: Récupérer department_code à partir de l'ID
 */
const getDepartmentCodeFromId = async (departmentId) => {
  if (!departmentId) return null;

  try {
    const result = await db.query(
      `SELECT code FROM departments WHERE id = $1`,
      [departmentId],
    );
    return result.rows[0]?.code || null;
  } catch (error) {
    console.error("Error getting department code:", error);
    return null;
  }
};

const reportController = {
  async initializeBuilder(req, res) {
    try {
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
      const { period_start, period_end, layout, dateRange, visibility, title } =
        req.body;

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
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
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

      const isDG = ["DG", "ADMIN"].includes(
        String(user?.role || "").toUpperCase(),
      );

      const filters = {
        search,
        page,
        limit,
      };

      if (isDG) {
        filters.status = status || "soumis";
        if (visibility) filters.visibility = visibility;
        if (department_id) filters.department_id = department_id;
      } else {
        filters.status = status;
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

      const report = await reportService.getReportDetails(id);

      if (!report) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const permissions = buildReportPermissions(user, report);

      if (!permissions.canRead) {
        return res.status(403).json({
          success: false,
          message: "Accès restreint",
          data: {
            needsAccessRequest: permissions.canRequestAccess,
            permissions,
          },
        });
      }

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
      const { period_start, period_end, layout, dateRange, visibility, title } =
        req.body;

      if (!title || !period_start || !period_end) {
        return errorResponse(
          res,
          "Titre et dates obligatoires",
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

      const existingReport = await reportService.getReportDetails(id);

      if (!existingReport) {
        return errorResponse(res, "Rapport introuvable", HTTP_STATUS.NOT_FOUND);
      }

      const permissions = buildReportPermissions(req.user, existingReport);

      if (!permissions.canEdit) {
        return errorResponse(
          res,
          "Vous n'avez pas la permission de modifier ce rapport",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const departmentId = req.user.department_id || req.user.department?.id;

      const snapshot = await generateSnapshot(layout, departmentId, dateRange);

      const reportData = {
        title,
        layout,
        renderedLayout: layout,
        sourceData: snapshot,
        dateRange,
      };

      const updated = await db.query(
        `UPDATE reports
         SET title = $1,
             period_start = $2,
             period_end = $3,
             visibility = $4,
             layout = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          title,
          period_start,
          period_end,
          visibility || "private",
          reportData,
          id,
        ],
      );

      await AuditLog.create({
        user_id: req.user.id,
        action: "UPDATE",
        entity_type: "report",
        entity_id: id,
        details: { period_start, period_end, visibility, title },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { report: updated.rows[0] },
        "Rapport mis à jour avec succès",
      );
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

      const existingReport = await reportService.getReportDetails(id);

      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const permissions = buildReportPermissions(req.user, existingReport);

      if (!permissions.canSubmit) {
        return errorResponse(
          res,
          "Vous n'avez pas la permission de soumettre ce rapport",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const report = await Report.submit(id, req.user.id);

      if (!report) {
        return errorResponse(
          res,
          "Rapport non trouvé ou déjà soumis",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      await AuditLog.create({
        user_id: req.user.id,
        action: "SUBMIT",
        entity_type: "report",
        entity_id: id,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

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

      const existingReport = await reportService.getReportDetails(id);

      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const permissions = buildReportPermissions(req.user, existingReport);

      if (!permissions.canValidate) {
        return errorResponse(
          res,
          "Vous n'avez pas la permission de valider ou rejeter ce rapport",
          HTTP_STATUS.FORBIDDEN,
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

      await AuditLog.create({
        user_id: req.user.id,
        action: "VALIDATE",
        entity_type: "report",
        entity_id: id,
        details: { status, comments },
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

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

      const existingReport = await reportService.getReportDetails(id);

      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const permissions = buildReportPermissions(req.user, existingReport);

      if (!permissions.canDelete) {
        return errorResponse(
          res,
          "Vous n'avez pas la permission de supprimer ce rapport",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const report = await Report.delete(id, req.user.id);

      if (!report) {
        return errorResponse(
          res,
          "Rapport non trouvé ou impossible à supprimer",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

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

      const report = await reportService.getReportDetails(id);

      if (!report) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const permissions = buildReportPermissions(req.user, report);

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

      if (!departmentId || departmentId === "undefined") {
        return errorResponse(
          res,
          "Valid Department ID is required",
          HTTP_STATUS.BAD_REQUEST,
        );
      }

      const stats = await Report.getDepartmentStats(departmentId);

      return successResponse(
        res,
        { stats },
        "Department stats retrieved successfully",
      );
    } catch (error) {
      console.error("Error fetching department stats:", error);
      return errorResponse(
        res,
        "Error retrieving department stats",
        HTTP_STATUS.INTERNAL_ERROR,
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
      const report = await Report.create({
        user_id: req.user.id,
        department_id: departmentId,
        period_start: periodStart,
        period_end: periodEnd,
        data: JSON.stringify({ layout }),
        visibility: visibility || "private",
      });

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

  async generateReport(req, res) {
    const { layout, title, periodStart, periodEnd, departmentId, visibility } =
      req.body;

    if (!title || !periodStart || !periodEnd || !layout) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    try {
      const report = await Report.create({
        user_id: req.user.id,
        department_id: departmentId,
        period_start: periodStart,
        period_end: periodEnd,
        data: JSON.stringify({ layout }),
        visibility: visibility || "private",
      });
      const pdfPath = await generatePdfReport(report);

      res
        .status(200)
        .json({ message: "Report generated successfully", pdfPath });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Error generating report" });
    }
  },

  async generatePdfReport(report) {
    const pdfPath = `/path/to/generated/reports/${report.id}.pdf`;
    return pdfPath;
  },

  async exportPdf(req, res) {
    try {
      const { id } = req.params;

      const report = await reportService.getReportDetails(id);

      if (!report) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const canRead = await reportAccessRequestService.canReadReport({
        reportId: id,
        user: req.user,
      });

      if (!canRead) {
        return errorResponse(res, "Accès refusé", HTTP_STATUS.FORBIDDEN);
      }

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="rapport_${id}.pdf"`,
      );

      doc.pipe(res);

      // Header
      doc.fontSize(20).text(report.title || `Rapport #${report.id}`, {
        align: "center",
      });

      doc.moveDown();
      doc.fontSize(10).text(`Département: ${report.department_name || "—"}`);
      doc.text(`Auteur: ${report.author_name || "—"}`);
      doc.text(`Statut: ${report.status || "—"}`);
      doc.text(
        `Période: ${report.period_start || "—"} à ${report.period_end || "—"}`,
      );
      doc.text(`Créé le: ${report.created_at || "—"}`);

      doc.moveDown();
      doc.fontSize(14).text("Données", { underline: true });
      doc.moveDown(0.5);

      let parsedData = report.data;

      if (typeof parsedData === "string") {
        try {
          parsedData = JSON.parse(parsedData);
        } catch {
          parsedData = { content: parsedData };
        }
      }

      const safeWriteObject = (obj, indent = 0) => {
        if (!obj || typeof obj !== "object") {
          doc.fontSize(10).text(String(obj ?? "—"), { indent });
          return;
        }

        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            doc.fontSize(10).font("Helvetica-Bold").text(`${key}:`, { indent });
            safeWriteObject(value, indent + 15);
          } else {
            doc
              .fontSize(10)
              .font("Helvetica")
              .text(`${key}: ${String(value ?? "—")}`, { indent });
          }
        });
      };

      safeWriteObject(parsedData);

      doc.moveDown();
      doc.fontSize(12).font("Helvetica-Bold").text("Signatures");
      doc.moveDown(2);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Établi par: ${report.author_name || "—"}`);
      doc.moveDown(2);
      doc.text(`Approuvé par: ${report.validator_name || "En attente"}`);

      doc.end();
    } catch (error) {
      console.error("Export PDF error:", error);
      return errorResponse(
        res,
        error.message || "Erreur lors de l'export PDF",
        HTTP_STATUS.BAD_REQUEST,
      );
    }
  },

  // ==========================================
  // NOUVELLES MÉTHODES AVEC DEPARTMENT CODE
  // ==========================================

 
  async getReportsByDepartment(req, res) {
    try {
      const { departmentCode } = req.params;
      const { page = 1, limit = 20, status, search } = req.query;
  
      console.log(`=== getReportsByDepartment ===`);
      console.log(`Department code: ${departmentCode}`);
      console.log(`User:`, { 
        id: req.user?.id, 
        role: req.user?.role,
        department_id: req.user?.department_id 
      });
  
      // Vérifier accès au département
      const hasAccess = await checkDepartmentAccessByCode(req.user, departmentCode);
      console.log(`Has access: ${hasAccess}`);
  
      if (!hasAccess) {
        return errorResponse(
          res,
          `Accès non autorisé au département ${departmentCode}. Votre rôle: ${req.user?.role}`,
          HTTP_STATUS.FORBIDDEN
        );
      }
  
      // Récupérer department_id
      const departmentId = await getDepartmentIdFromCode(departmentCode);
      console.log(`Department ID found: ${departmentId}`);
  
      if (!departmentId) {
        return notFoundResponse(res, `Département "${departmentCode}" non trouvé`);
      }
  
      // ... reste du code
    } catch (error) {
      console.error("getReportsByDepartment error:", error);
      return errorResponse(res, "Erreur lors de la récupération", HTTP_STATUS.INTERNAL_ERROR);
    }
  },
  async createReportForDepartment(req, res) {
    try {
      const { departmentCode } = req.params;
      const { period_start, period_end, layout, visibility, title, dateRange } =
        req.body;

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

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(
          res,
          "Accès non autorisé à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (!departmentId) {
        return notFoundResponse(res, "Département non trouvé");
      }

      const existing = await db.query(
        `SELECT id FROM reports 
         WHERE department_id = $1 AND period_start = $2 AND period_end = $3 AND status != 'rejete'`,
        [departmentId, period_start, period_end],
      );

      if (existing.rowCount > 0) {
        return errorResponse(
          res,
          "Un rapport existe déjà pour cette période",
          HTTP_STATUS.CONFLICT,
        );
      }

      let snapshot = null;
      if (typeof generateSnapshot === "function") {
        snapshot = await generateSnapshot(layout, departmentId, dateRange);
      }

      const reportData = {
        title: title || `Rapport ${departmentCode} - ${period_start}`,
        layout,
        renderedLayout: layout,
        sourceData: snapshot,
      };

      const report = await Report.create({
        user_id: req.user.id,
        department_id: departmentId,
        period_start,
        period_end,
        layout: reportData,
        visibility: visibility || "private",
      });

      if (AuditLog) {
        await AuditLog.create({
          user_id: req.user.id,
          action: "CREATE",
          entity_type: "report",
          entity_id: report.id,
          details: { departmentCode, period_start, period_end, title },
          ip_address: req.ip,
          user_agent: req.get("user-agent"),
        });
      }

      return createdResponse(res, { report }, "Rapport créé avec succès");
    } catch (error) {
      console.error("createReportForDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors de la création",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getReportDetailsByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(
          res,
          "Accès non autorisé à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const report = await reportService.getReportDetails(reportId);

      if (!report) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (report.department_id !== departmentId) {
        return errorResponse(
          res,
          "Ce rapport n'appartient pas à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const permissions = buildReportPermissions(req.user, report);

      if (!permissions.canRead) {
        return res.status(403).json({
          success: false,
          message: "Accès restreint",
          data: {
            needsAccessRequest: permissions.canRequestAccess,
            permissions,
          },
        });
      }

      return successResponse(res, { report, permissions }, "Rapport récupéré");
    } catch (error) {
      console.error("getReportDetailsByDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors du chargement",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async updateReportByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;
      const { period_start, period_end, layout, visibility, title } = req.body;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const existingReport = await reportService.getReportDetails(reportId);
      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (existingReport.department_id !== departmentId) {
        return errorResponse(
          res,
          "Ce rapport n'appartient pas à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const permissions = buildReportPermissions(req.user, existingReport);
      if (!permissions.canEdit) {
        return errorResponse(res, "Permission refusée", HTTP_STATUS.FORBIDDEN);
      }

      const updated = await db.query(
        `UPDATE reports
         SET title = COALESCE($1, title),
             period_start = COALESCE($2, period_start),
             period_end = COALESCE($3, period_end),
             visibility = COALESCE($4, visibility),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [title, period_start, period_end, visibility, reportId],
      );

      await AuditLog.create({
        user_id: req.user.id,
        action: "UPDATE",
        entity_type: "report",
        entity_id: reportId,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { report: updated.rows[0] },
        "Rapport mis à jour",
      );
    } catch (error) {
      console.error("updateReportByDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors de la mise à jour",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async deleteReportByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const existingReport = await reportService.getReportDetails(reportId);
      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (existingReport.department_id !== departmentId) {
        return errorResponse(
          res,
          "Ce rapport n'appartient pas à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const permissions = buildReportPermissions(req.user, existingReport);
      if (!permissions.canDelete) {
        return errorResponse(res, "Permission refusée", HTTP_STATUS.FORBIDDEN);
      }

      const report = await Report.delete(reportId, req.user.id);

      await AuditLog.create({
        user_id: req.user.id,
        action: "DELETE",
        entity_type: "report",
        entity_id: reportId,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, null, "Rapport supprimé");
    } catch (error) {
      console.error("deleteReportByDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors de la suppression",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async submitReportByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const existingReport = await reportService.getReportDetails(reportId);
      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (existingReport.department_id !== departmentId) {
        return errorResponse(
          res,
          "Ce rapport n'appartient pas à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const permissions = buildReportPermissions(req.user, existingReport);
      if (!permissions.canSubmit) {
        return errorResponse(res, "Permission refusée", HTTP_STATUS.FORBIDDEN);
      }

      const report = await Report.submit(reportId, req.user.id);

      await AuditLog.create({
        user_id: req.user.id,
        action: "SUBMIT",
        entity_type: "report",
        entity_id: reportId,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(res, { report }, "Rapport soumis pour validation");
    } catch (error) {
      console.error("submitReportByDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors de la soumission",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async validateReportByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;
      const { status, comments } = req.body;

      if (!["valide", "rejete"].includes(status)) {
        return errorResponse(res, "Statut invalide", HTTP_STATUS.BAD_REQUEST);
      }

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const existingReport = await reportService.getReportDetails(reportId);
      if (!existingReport) {
        return notFoundResponse(res, "Rapport introuvable");
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (existingReport.department_id !== departmentId) {
        return errorResponse(
          res,
          "Ce rapport n'appartient pas à ce département",
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const permissions = buildReportPermissions(req.user, existingReport);
      if (!permissions.canValidate) {
        return errorResponse(res, "Permission refusée", HTTP_STATUS.FORBIDDEN);
      }

      const report = await Report.validate(reportId, req.user.id, {
        status,
        comments,
      });

      await AuditLog.create({
        user_id: req.user.id,
        action: "VALIDATE",
        entity_type: "report",
        entity_id: reportId,
        ip_address: req.ip,
        user_agent: req.get("user-agent"),
      });

      return successResponse(
        res,
        { report },
        status === "valide" ? "Rapport validé" : "Rapport rejeté",
      );
    } catch (error) {
      console.error("validateReportByDepartment error:", error);
      return errorResponse(
        res,
        "Erreur lors de la validation",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getDepartmentStatsByCode(req, res) {
    try {
      const { departmentCode } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const departmentId = await getDepartmentIdFromCode(departmentCode);
      if (!departmentId) {
        return notFoundResponse(res, "Département non trouvé");
      }

      const stats = await Report.getDepartmentStats(departmentId);

      return successResponse(
        res,
        { stats, departmentCode },
        "Statistiques récupérées",
      );
    } catch (error) {
      console.error("getDepartmentStatsByCode error:", error);
      return errorResponse(
        res,
        "Erreur lors de la récupération",
        HTTP_STATUS.INTERNAL_ERROR,
      );
    }
  },

  async getCommentsByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const comments = await Report.getComments(reportId);
      return successResponse(res, { comments }, "Commentaires récupérés");
    } catch (error) {
      console.error("getCommentsByDepartment error:", error);
      return errorResponse(res, "Erreur", HTTP_STATUS.INTERNAL_ERROR);
    }
  },

  async addCommentByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;
      const { content } = req.body;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const newComment = await Report.addComment(
        reportId,
        req.user.id,
        content,
      );
      return createdResponse(
        res,
        { comment: newComment },
        "Commentaire ajouté",
      );
    } catch (error) {
      console.error("addCommentByDepartment error:", error);
      return errorResponse(res, "Erreur", HTTP_STATUS.INTERNAL_ERROR);
    }
  },

  async markAsReadByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      await Report.markAsRead(reportId, req.user.id);
      return successResponse(res, null, "Marqué comme lu");
    } catch (error) {
      console.error("markAsReadByDepartment error:", error);
      return errorResponse(res, "Erreur", HTTP_STATUS.INTERNAL_ERROR);
    }
  },

  async getReadersByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const readers = await Report.getReaders(reportId);
      return successResponse(res, { readers }, "Lecteurs récupérés");
    } catch (error) {
      console.error("getReadersByDepartment error:", error);
      return errorResponse(res, "Erreur", HTTP_STATUS.INTERNAL_ERROR);
    }
  },

  async addAnnotationByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;
      const { selected_text, comment, decision, range_meta } = req.body;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      const annotation = await Report.addAnnotation(reportId, req.user.id, {
        selected_text,
        comment,
        decision,
        range_meta,
      });

      return createdResponse(res, { annotation }, "Annotation ajoutée");
    } catch (error) {
      console.error("addAnnotationByDepartment error:", error);
      return errorResponse(res, "Erreur", HTTP_STATUS.INTERNAL_ERROR);
    }
  },

  async exportPdfByDepartment(req, res) {
    try {
      const { departmentCode, reportId } = req.params;

      const hasAccess = await checkDepartmentAccessByCode(
        req.user,
        departmentCode,
      );
      if (!hasAccess) {
        return errorResponse(res, "Accès non autorisé", HTTP_STATUS.FORBIDDEN);
      }

      // Reconstruire req.params pour la méthode exportPdf
      req.params = { id: reportId };
      await reportController.exportPdf(req, res);
    } catch (error) {
      console.error("exportPdfByDepartment error:", error);
      return errorResponse(res, "Erreur d'export", HTTP_STATUS.INTERNAL_ERROR);
    }
  },
};

module.exports = reportController;
