const reportCommentService = require("../service/reportCommentService");

const reportCommentController = {
  async addComment(req, res, next) {
    try {
      const io = req.app.get("io");

      const comment = await reportCommentService.addComment({
        reportId: parseInt(req.params.reportId),
        user: req.user,
        comment: req.body.comment,
        io,
      });

      res.status(201).json({ success: true, comment });
    } catch (err) {
      next(err);
    }
  },

  async listComments(req, res, next) {
    try {
      const comments = await reportCommentService.listComments(
        parseInt(req.params.reportId),
        req.user,
      );

      res.json({ success: true, comments });
    } catch (err) {
      next(err);
    }
  },

  async deleteComment(req, res, next) {
    try {
      await reportCommentService.deleteComment({
        commentId: parseInt(req.params.id),
        user: req.user,
      });

      res.json({ success: true, message: "Commentaire supprimé" });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = reportCommentController;
