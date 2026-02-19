const model = require("../models/reportAccessRequestModel");
const reportModel = require("../models/reportModel");
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require("../utils/errorHandler");
const db = require("../config/database");

const reportAccessRequestService = {
  async requestAccess(user, reportId) {
    const report = await reportModel.findById(reportId);

    if (!report) throw new NotFoundError("Rapport introuvable");

    if (report.department_id === user.department_id)
      throw new ConflictError("Votre département possède déjà ce rapport");

    if (report.visibility !== "public")
      throw new ForbiddenError("Rapport privé");

    return model.create(reportId, user.department_id);
  },

  async approve(user, requestId) {
    if (!["direction", "admin"].includes(user.role))
      throw new ForbiddenError("Accès refusé");

    const request = await model.findById(requestId);
    if (!request) throw new NotFoundError("Demande introuvable");

    return model.approve(requestId, user.id);
  },

  async reject(user, requestId) {
    if (!["direction", "admin"].includes(user.role))
      throw new ForbiddenError("Accès refusé");

    const request = await model.findById(requestId);
    if (!request) throw new NotFoundError("Demande introuvable");

    return model.reject(requestId, user.id);
  },

  async canAccess(user, report) {
    if (["direction", "admin"].includes(user.role)) return true;

    if (report.department_id === user.department_id) return true;

    if (report.visibility !== "public") return false;

    return model.hasApprovedAccess(report.id, user.department_id);
  },
};

module.exports = reportAccessRequestService;
