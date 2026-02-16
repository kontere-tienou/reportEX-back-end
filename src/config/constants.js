// BATEX-CI Reporting System - Constants
// Toutes les constantes de l'application centralisées

// Statuts des rapports
export const REPORT_STATUS = {
    DRAFT: 'brouillon',
    SUBMITTED: 'soumis',
    VALIDATED: 'valide',
    REJECTED: 'rejete'
};

// Rôles utilisateurs
export const USER_ROLES = {
    ADMIN: 'admin',
    VALIDATOR: 'validateur',
    RESPONSIBLE: 'responsable'
};

// Fréquences des rapports
export const REPORT_FREQUENCIES = {
    WEEKLY: 'hebdomadaire',
    MONTHLY: 'mensuel',
    QUARTERLY: 'trimestriel',
    ANNUAL: 'annuel'
};

// Types de notifications
export const NOTIFICATION_TYPES = {
    REMINDER: 'rappel',
    VALIDATION: 'validation',
    SUBMISSION: 'soumission',
    REJECTION: 'rejection',
    SYSTEM: 'systeme'
};

// Types d'actions audit
export const AUDIT_ACTIONS = {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    CREATE_REPORT: 'CREATE_REPORT',
    UPDATE_REPORT: 'UPDATE_REPORT',
    SUBMIT_REPORT: 'SUBMIT_REPORT',
    VALIDATE_REPORT: 'VALIDATE_REPORT',
    REJECT_REPORT: 'REJECT_REPORT',
    DELETE_REPORT: 'DELETE_REPORT',
    CREATE_USER: 'CREATE_USER',
    UPDATE_USER: 'UPDATE_USER',
    DELETE_USER: 'DELETE_USER'
};

// Types de champs de formulaire
export const FIELD_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    TEXTAREA: 'textarea',
    DATE: 'date',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    FILE: 'file'
};

// Limites de l'application
export const LIMITS = {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_FILES_PER_REPORT: 10,
    MAX_REPORT_DATA_SIZE: 1024 * 1024, // 1MB JSON
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50
};

// Messages d'erreur standards
export const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Non autorisé. Veuillez vous connecter.',
    FORBIDDEN: 'Accès refusé. Vous n\'avez pas les permissions nécessaires.',
    NOT_FOUND: 'Ressource non trouvée.',
    VALIDATION_ERROR: 'Erreur de validation des données.',
    SERVER_ERROR: 'Erreur serveur. Veuillez réessayer plus tard.',
    INVALID_CREDENTIALS: 'Identifiants invalides.',
    DUPLICATE_ENTRY: 'Cette entrée existe déjà.',
    REPORT_ALREADY_SUBMITTED: 'Ce rapport a déjà été soumis.',
    REPORT_ALREADY_VALIDATED: 'Ce rapport a déjà été validé.',
    INVALID_DATE_RANGE: 'La période sélectionnée est invalide.',
    FILE_TOO_LARGE: 'Le fichier est trop volumineux.',
    INVALID_FILE_TYPE: 'Type de fichier non autorisé.'
};

// Messages de succès standards
export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Connexion réussie.',
    LOGOUT_SUCCESS: 'Déconnexion réussie.',
    REPORT_CREATED: 'Rapport créé avec succès.',
    REPORT_UPDATED: 'Rapport mis à jour avec succès.',
    REPORT_SUBMITTED: 'Rapport soumis pour validation.',
    REPORT_VALIDATED: 'Rapport validé avec succès.',
    REPORT_REJECTED: 'Rapport rejeté.',
    USER_CREATED: 'Utilisateur créé avec succès.',
    USER_UPDATED: 'Utilisateur mis à jour avec succès.',
    PASSWORD_CHANGED: 'Mot de passe modifié avec succès.',
    EMAIL_SENT: 'Email envoyé avec succès.'
};

// Configuration emails
export const EMAIL_TEMPLATES = {
    REPORT_SUBMITTED: {
        subject: 'Nouveau rapport à valider - BATEX-CI',
        priority: 'high'
    },
    REPORT_VALIDATED: {
        subject: 'Votre rapport a été validé - BATEX-CI',
        priority: 'normal'
    },
    REPORT_REJECTED: {
        subject: 'Votre rapport a été rejeté - BATEX-CI',
        priority: 'high'
    },
    WEEKLY_REMINDER: {
        subject: 'Rappel: Rapport hebdomadaire à soumettre - BATEX-CI',
        priority: 'normal'
    },
    MONTHLY_REMINDER: {
        subject: 'Rappel: Rapport mensuel à soumettre - BATEX-CI',
        priority: 'normal'
    }
};

// Jours de la semaine (pour cron)
export const WEEKDAYS = {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 0
};

// Configuration pagination
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
};

// Types MIME autorisés pour upload
export const ALLOWED_MIME_TYPES = {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENTS: ['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ALL: ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};

// Configuration rate limiting
export const RATE_LIMITS = {
    LOGIN: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5 // 5 tentatives
    },
    API: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // 100 requêtes
    },
    REPORT_SUBMISSION: {
        windowMs: 60 * 60 * 1000, // 1 heure
        max: 10 // 10 soumissions
    }
};

// Codes d'erreur HTTP
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
};

// IDs des départements (correspondent à la DB)
export const DEPARTMENTS = {
    COMPTABILITE: 1,
    BUREAU_ETUDE: 2,
    MAINTENANCE: 3,
    FILATURE: 4,
    IMPRESSION: 5,
    STOCK: 6,
    ACHATS: 7,
    COMMERCIAL: 8,
    INFORMATIQUE: 9,
    RH: 10
};

// Export par défaut de toutes les constantes
export default {
    REPORT_STATUS,
    USER_ROLES,
    REPORT_FREQUENCIES,
    NOTIFICATION_TYPES,
    AUDIT_ACTIONS,
    FIELD_TYPES,
    LIMITS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    EMAIL_TEMPLATES,
    WEEKDAYS,
    PAGINATION,
    ALLOWED_MIME_TYPES,
    RATE_LIMITS,
    HTTP_STATUS,
    DEPARTMENTS
};