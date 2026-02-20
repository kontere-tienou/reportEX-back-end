const db = require("../config/database");
const reportAccessRequestModel = require("../models/reportAccessRequestModel");

// Si tu as des erreurs custom, remplace par les tiennes
const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require("../utils/errorHandler");

async function notifyUsers(io, userIds, payload) {
  if (!io) return;
  userIds.forEach((uid) => io.to(`user:${uid}`).emit("notification", payload));
}

const reportAccessRequestService = {
  /**
   * Demande d'accès à un rapport public d'un autre département
   */
  async requestAccess({ reportId, user, io }) {
    // 1) Charger rapport + visiblité
    const reportRes = await db.query(
      `SELECT id, department_id, visibility, user_id
       FROM reports
       WHERE id = $1`,
      [reportId],
    );
    if (reportRes.rowCount === 0)
      throw new NotFoundError("Rapport introuvable");

    const report = reportRes.rows[0];

    // 2) Direction/Admin n'ont pas besoin de demande
    if (["direction", "admin"].includes(user.role)) {
      throw new ConflictError("La direction/admin a déjà accès sans demande");
    }

    // 3) Interdire si même dept
    if (report.department_id === user.department_id) {
      throw new ConflictError("Votre département a déjà accès à ce rapport");
    }

    // 4) Interdire si private
    if (report.visibility !== "public") {
      throw new ForbiddenError("Ce rapport est privé (demande impossible)");
    }

    // 5) éviter doublons pending
    const pending = await reportAccessRequestModel.findPendingByReportAndDept(
      reportId,
      user.department_id,
    );
    if (pending) {
      throw new ConflictError(
        "Une demande est déjà en attente pour ce rapport",
      );
    }

    // 6) Créer la demande
    const request = await reportAccessRequestModel.create({
      reportId,
      requesterId: user.id,
      requesterDepartmentId: user.department_id,
    });

    // 7) Audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        "REQUEST_REPORT_ACCESS",
        "report_access_request",
        request.id,
        JSON.stringify({ reportId }),
      ],
    );

    // 8) Notifier direction/admin (DB + realtime)
    const validatorsRes = await db.query(
      `SELECT id FROM users
       WHERE role IN ('direction','admin','validateur') AND is_active = true`,
    );
    const validatorIds = validatorsRes.rows.map((r) => r.id);

    if (validatorIds.length > 0) {
      // DB notifications
      const values = validatorIds
        .map(
          (_, i) =>
            `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`,
        )
        .join(",");

      const params = validatorIds.flatMap((uid) => [
        uid,
        "access_request",
        "Demande d'accès à un rapport",
        `Un département demande l'accès au rapport #${reportId}`,
        `/reports/${reportId}`,
      ]);

      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ${values}`,
        params,
      );

      // Realtime
      await notifyUsers(io, validatorIds, {
        type: "access_request",
        title: "Demande d'accès à un rapport",
        message: `Un département demande l'accès au rapport #${reportId}`,
        link: `/reports/${reportId}`,
        meta: { reportId, requestId: request.id },
      });
    }

    return request;
  },

  /**
   * Liste des demandes pending (direction/admin)
   */
  async listPending() {
    return reportAccessRequestModel.listPending();
  },

  /**
   * Approve demande (direction/admin)
   */
  async approve({ requestId, reviewer, io }) {
    if (!["direction", "admin"].includes(reviewer.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    const reqRow = await reportAccessRequestModel.findById(requestId);
    if (!reqRow) throw new NotFoundError("Demande introuvable");

    const updated = await reportAccessRequestModel.approve(
      requestId,
      reviewer.id,
    );
    if (!updated)
      throw new ConflictError("Demande déjà traitée ou introuvable");

    // Audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reviewer.id,
        "APPROVE_REPORT_ACCESS",
        "report_access_request",
        requestId,
        JSON.stringify({ reportId: reqRow.report_id }),
      ],
    );

    // Notifier requester (DB + realtime)
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        reqRow.requester_id,
        "access_request",
        "Accès approuvé",
        `Votre demande d'accès au rapport #${reqRow.report_id} a été approuvée`,
        `/reports/${reqRow.report_id}`,
      ],
    );

    await notifyUsers(io, [reqRow.requester_id], {
      type: "access_approved",
      title: "Accès approuvé",
      message: `Votre demande d'accès au rapport #${reqRow.report_id} a été approuvée`,
      link: `/reports/${reqRow.report_id}`,
      meta: { reportId: reqRow.report_id, requestId },
    });

    return updated;
  },

  /**
   * Reject demande (direction/admin)
   */
  async reject({ requestId, reviewer, io }) {
    if (!["direction", "admin"].includes(reviewer.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    const reqRow = await reportAccessRequestModel.findById(requestId);
    if (!reqRow) throw new NotFoundError("Demande introuvable");

    const updated = await reportAccessRequestModel.reject(
      requestId,
      reviewer.id,
    );
    if (!updated)
      throw new ConflictError("Demande déjà traitée ou introuvable");

    // Audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reviewer.id,
        "REJECT_REPORT_ACCESS",
        "report_access_request",
        requestId,
        JSON.stringify({ reportId: reqRow.report_id }),
      ],
    );

    // Notifier requester (DB + realtime)
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        reqRow.requester_id,
        "access_request",
        "Accès refusé",
        `Votre demande d'accès au rapport #${reqRow.report_id} a été refusée`,
        null,
      ],
    );

    await notifyUsers(io, [reqRow.requester_id], {
      type: "access_rejected",
      title: "Accès refusé",
      message: `Votre demande d'accès au rapport #${reqRow.report_id} a été refusée`,
      link: null,
      meta: { reportId: reqRow.report_id, requestId },
    });

    return updated;
  },

  /**
   * Check accès lecture (utilisé par reportService/reportController)
   */
  async canReadReport({ reportId, user }) {
    // direction/admin => ok
    if (["direction", "admin"].includes(user.role)) return true;

    const reportRes = await db.query(
      `SELECT id, department_id, visibility FROM reports WHERE id = $1`,
      [reportId],
    );
    if (reportRes.rowCount === 0) return false;

    const report = reportRes.rows[0];

    // même dept => ok
    if (report.department_id === user.department_id) return true;

    // si private => non
    if (report.visibility !== "public") return false;

    // public + demande approuvée
    return reportAccessRequestModel.hasApprovedAccess(
      reportId,
      user.department_id,
    );
  },
};

module.exports = reportAccessRequestService;
