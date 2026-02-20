const reportAccessRequestService = require("../service/reportAccessRequestService");

const reportAccessRequestController = {
  async requestAccess(req, res, next) {
    try {
      const io = req.app.get("io");

      const request = await reportAccessRequestService.requestAccess({
        reportId: parseInt(req.params.reportId, 10),
        user: req.user,
        io,
      });

      res.status(201).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  },

  async listPending(req, res, next) {
    try {
      const requests = await reportAccessRequestService.listPending();
      res.json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const io = req.app.get("io");

      const updated = await reportAccessRequestService.approve({
        requestId: parseInt(req.params.id, 10),
        reviewer: req.user,
        io,
      });

      res.json({ success: true, request: updated });
    } catch (err) {
      next(err);
    }
  },

  async reject(req, res, next) {
    try {
      const io = req.app.get("io");

      const updated = await reportAccessRequestService.reject({
        requestId: parseInt(req.params.id, 10),
        reviewer: req.user,
        io,
      });

      res.json({ success: true, request: updated });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = reportAccessRequestController;
