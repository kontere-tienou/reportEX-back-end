const { HTTP_STATUS } = require('../config/constants');

/**
 * Formatteurs de réponses HTTP standardisés
 */

// Réponse de succès générique
const successResponse = (res, data, message = 'Succès', statusCode = HTTP_STATUS.OK) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

// Réponse de création réussie
const createdResponse = (res, data, message = 'Créé avec succès') => {
    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message,
        data
    });
};

// Réponse sans contenu (pour DELETE généralement)
const noContentResponse = (res) => {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
};

// Réponse d'erreur générique
const errorResponse = (res, message = 'Erreur', statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errors = null) => {
    const response = {
        success: false,
        message
    };

    if (errors) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

// Réponse de validation échouée
const validationErrorResponse = (res, errors) => {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Erreur de validation',
        errors
    });
};

// Réponse non autorisé (401)
const unauthorizedResponse = (res, message = 'Non authentifié') => {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message
    });
};

// Réponse interdit (403)
const forbiddenResponse = (res, message = 'Accès interdit') => {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message
    });
};

// Réponse non trouvé (404)
const notFoundResponse = (res, message = 'Ressource non trouvée') => {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message
    });
};

// Réponse avec pagination
const paginatedResponse = (res, data, pagination) => {
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            totalPages: Math.ceil(pagination.total / pagination.limit)
        }
    });
};

// Wrapper pour les opérations asynchrones
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Formatteur de données utilisateur (enlève les données sensibles)
const formatUser = (user) => {
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

// Formatteur de liste d'utilisateurs
const formatUsers = (users) => {
    return users.map(formatUser);
};

// Formatteur de rapport (ajoute des métadonnées calculées)
const formatReport = (report) => {
    return {
        ...report,
        // Parser les données JSON si nécessaire
        data: typeof report.data === 'string' ? JSON.parse(report.data) : report.data,
        // Ajouter des métadonnées
        metadata: {
            canEdit: report.status === 'brouillon' || report.status === 'rejete',
            canSubmit: report.status === 'brouillon',
            canValidate: report.status === 'soumis',
            isOverdue: false // TODO: calculer si en retard
        }
    };
};

// Formatteur de liste de rapports
const formatReports = (reports) => {
    return reports.map(formatReport);
};

// Formatteur de statistiques
const formatStats = (stats) => {
    return {
        ...stats,
        // Convertir les strings en nombres si nécessaire
        total_reports: parseInt(stats.total_reports) || 0,
        validated_reports: parseInt(stats.validated_reports) || 0,
        pending_reports: parseInt(stats.pending_reports) || 0,
        rejected_reports: parseInt(stats.rejected_reports) || 0,
        draft_reports: parseInt(stats.draft_reports) || 0,
        // Calculer des pourcentages
        validation_rate: stats.total_reports > 0
            ? ((parseInt(stats.validated_reports) / parseInt(stats.total_reports)) * 100).toFixed(2)
            : 0,
        rejection_rate: stats.total_reports > 0
            ? ((parseInt(stats.rejected_reports) / parseInt(stats.total_reports)) * 100).toFixed(2)
            : 0
    };
};

// Helper pour construire des filtres SQL
const buildSQLFilters = (filters) => {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            conditions.push(`${key} = $${paramCount}`);
            params.push(value);
            paramCount++;
        }
    });

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params
    };
};

// Helper pour la pagination SQL
const buildPagination = (page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    return {
        limit,
        offset,
        page: parseInt(page),
        limitClause: `LIMIT ${limit} OFFSET ${offset}`
    };
};

// Helper pour formater les dates en français
const formatDateFR = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Helper pour formater les dates et heures
const formatDateTimeFR = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Helper pour calculer la période de la semaine courante
const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Dimanche = 7

    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
        start: monday,
        end: sunday
    };
};

// Helper pour calculer la période du mois courant
const getCurrentMonth = () => {
    const now = new Date();

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    return {
        start: firstDay,
        end: lastDay
    };
};

module.exports = {
    // Réponses HTTP
    successResponse,
    createdResponse,
    noContentResponse,
    errorResponse,
    validationErrorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    paginatedResponse,
    asyncHandler,

    // Formatteurs de données
    formatUser,
    formatUsers,
    formatReport,
    formatReports,
    formatStats,

    // Helpers SQL
    buildSQLFilters,
    buildPagination,

    // Helpers dates
    formatDateFR,
    formatDateTimeFR,
    getCurrentWeek,
    getCurrentMonth
};