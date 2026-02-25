const db = require("../config/database");
const reportAccessRequestModel = require("../models/reportAccessRequestModel");

const {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} = require("../middleware/errorHandler");

async function notifyUsers(io, userIds, payload) {
  if (!io) return;
  userIds.forEach((uid) => io.to(`user:${uid}`).emit("notification", payload));
}

const reportAccessRequestService = {
  /**
   * Demande d'accès à un rapport public d'un autre département
   */
  async requestAccess({ reportId, user, io, reason = null }) {
    // 1) Charger rapport
    const reportRes = await db.query(
      `SELECT id, department_id, visibility, user_id
       FROM reports
       WHERE id = $1`,
      [reportId],
    );

    if (reportRes.rowCount === 0) {
      throw new NotFoundError("Rapport introuvable");
    }

    const report = reportRes.rows[0];

    // 2) Direction/Admin => pas besoin de demande
    if (["DG", "ADMIN"].includes(user.role)) {
      throw new ConflictError("La direction/admin a déjà accès sans demande");
    }

    // 3) Auteur du rapport => a déjà accès
    if (report.user_id === user.id) {
      throw new ConflictError("Vous êtes l'auteur de ce rapport");
    }

    // 4) Même département => a déjà accès
    if (report.department_id === user.department_id) {
      throw new ConflictError("Votre département a déjà accès à ce rapport");
    }

    // 5) Private => demande impossible
    if (report.visibility !== "public") {
      throw new ForbiddenError("Ce rapport est privé (demande impossible)");
    }

    // 6) Déjà approuvé pour cet utilisateur ?
    const alreadyApproved = await reportAccessRequestModel.hasApprovedAccess(
      reportId,
      user.id,
    );
    if (alreadyApproved) {
      throw new ConflictError("Vous avez déjà accès à ce rapport");
    }

    // 7) Éviter doublon pending (par département)
    const pendingDept =
      await reportAccessRequestModel.findPendingByReportAndDept(
        reportId,
        user.department_id,
      );
    if (pendingDept) {
      throw new ConflictError(
        "Une demande est déjà en attente pour ce rapport dans votre département",
      );
    }

    // (Optionnel) Éviter doublon pending par user
    const pendingUser =
      await reportAccessRequestModel.findPendingByReportAndUser(
        reportId,
        user.id,
      );
    if (pendingUser) {
      throw new ConflictError("Vous avez déjà une demande en attente");
    }

    // 8) Créer la demande
    const request = await reportAccessRequestModel.create({
      reportId,
      requesterId: user.id,
      reason,
    });

    // 9) Audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        "REQUEST_REPORT_ACCESS",
        "report_access_request",
        request.id,
        JSON.stringify({ reportId, reason }),
      ],
    );

    // 10) Notifier direction/admin/validateur
    const validatorsRes = await db.query(
      `SELECT id FROM users
       WHERE role IN ('DG','ADMIN')
         AND is_active = true`,
    );

    const validatorIds = validatorsRes.rows.map((r) => r.id);

    if (validatorIds.length > 0) {
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
        `Un utilisateur demande l'accès au rapport #${reportId}`,
        `/reports/${reportId}`,
      ]);

      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, link)
         VALUES ${values}`,
        params,
      );

      await notifyUsers(io, validatorIds, {
        type: "access_request",
        title: "Demande d'accès à un rapport",
        message: `Un utilisateur demande l'accès au rapport #${reportId}`,
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
    if (![ "DG", "ADMIN"].includes(reviewer.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    const reqRow = await reportAccessRequestModel.findById(requestId);
    if (!reqRow) throw new NotFoundError("Demande introuvable");

    const updated = await reportAccessRequestModel.approve(
      requestId,
      reviewer.id,
    );
    if (!updated) {
      throw new ConflictError("Demande déjà traitée ou introuvable");
    }

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
  async reject({ requestId, reviewer, io, rejectionReason = null }) {
    if (![ "DG", "ADMIN"].includes(reviewer.role)) {
      throw new ForbiddenError("Accès refusé");
    }

    const reqRow = await reportAccessRequestModel.findById(requestId);
    if (!reqRow) throw new NotFoundError("Demande introuvable");

    const updated = await reportAccessRequestModel.reject(
      requestId,
      reviewer.id,
      rejectionReason,
    );
    if (!updated) {
      throw new ConflictError("Demande déjà traitée ou introuvable");
    }

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        reviewer.id,
        "REJECT_REPORT_ACCESS",
        "report_access_request",
        requestId,
        JSON.stringify({ reportId: reqRow.report_id, rejectionReason }),
      ],
    );

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
   * Vérifie si l'utilisateur peut lire le rapport
   */
  async canReadReport({ reportId, user }) {
    // 1) Direction/admin => accès direct
    if ([ "DG", "ADMIN"].includes(user.role)) {
      return true;
    }

    // 2) Charger rapport
    const reportRes = await db.query(
      `SELECT id, user_id, department_id, visibility FROM reports WHERE id = $1`,
      [reportId],
    );

    if (reportRes.rowCount === 0) return false;

    const report = reportRes.rows[0];

    // 3) Auteur => accès direct
    if (report.user_id === user.id) return true;

    // 4) Même département => accès direct
    if (report.department_id === user.department_id) return true;

    // 5) Private => refus
    if (report.visibility !== "public") return false;

    // 6) Public + demande approuvée (USER)
    return reportAccessRequestModel.hasApprovedAccess(reportId, user.id);
  },
};

module.exports = reportAccessRequestService;
