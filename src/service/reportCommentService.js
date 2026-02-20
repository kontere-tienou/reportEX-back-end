const db = require("../config/database");
const reportCommentModel = require("../models/reportCommentModel");
const reportAccessRequestService = require("./reportAccessRequestService");

const { NotFoundError, ForbiddenError } = require("../utils/errorHandler");

const reportCommentService = {
  /**
   * Ajouter commentaire
   */
  async addComment({ reportId, user, comment, io }) {
    if (!comment || comment.trim() === "") {
      throw new Error("Le commentaire ne peut pas être vide");
    }

    // Vérifier accès lecture au rapport
    const canRead = await reportAccessRequestService.canReadReport({
      reportId,
      user,
    });

    if (!canRead) {
      throw new ForbiddenError("Accès refusé au rapport");
    }

    const created = await reportCommentModel.create({
      reportId,
      userId: user.id,
      comment,
    });

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [user.id, "ADD_REPORT_COMMENT", "report_comment", created.id],
    );

    // Notifier auteur du rapport
    const reportRes = await db.query(
      `SELECT user_id FROM reports WHERE id = $1`,
      [reportId],
    );

    if (reportRes.rowCount > 0) {
      const authorId = reportRes.rows[0].user_id;

      if (authorId !== user.id) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            authorId,
            "comment",
            "Nouveau commentaire",
            `Un commentaire a été ajouté sur votre rapport #${reportId}`,
            `/reports/${reportId}`,
          ],
        );

        if (io) {
          io.to(`user:${authorId}`).emit("notification", {
            type: "comment",
            title: "Nouveau commentaire",
            message: `Un commentaire a été ajouté sur votre rapport #${reportId}`,
            link: `/reports/${reportId}`,
          });
        }
      }
    }

    return created;
  },

  async listComments(reportId, user) {
    const canRead = await reportAccessRequestService.canReadReport({
      reportId,
      user,
    });

    if (!canRead) {
      throw new ForbiddenError("Accès refusé au rapport");
    }

    return reportCommentModel.findByReport(reportId);
  },

  async deleteComment({ commentId, user }) {
    const comment = await reportCommentModel.findById(commentId);
    if (!comment) throw new NotFoundError("Commentaire introuvable");

    // Seul auteur ou direction/admin peut supprimer
    if (
      comment.user_id !== user.id &&
      !["direction", "admin"].includes(user.role)
    ) {
      throw new ForbiddenError("Suppression non autorisée");
    }

    return reportCommentModel.delete(commentId);
  },
};

module.exports = reportCommentService;
