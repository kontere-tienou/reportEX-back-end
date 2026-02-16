const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');
const { LIMITS } = require('../config/constants');

// Middleware pour gérer les résultats de validation
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        throw new ValidationError(errorMessages);
    }
    next();
};

// Validations pour l'authentification
const loginValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Le nom d\'utilisateur est requis')
        .isLength({ min: LIMITS.USERNAME_MIN_LENGTH })
        .withMessage(`Le nom d'utilisateur doit contenir au moins ${LIMITS.USERNAME_MIN_LENGTH} caractères`),
    body('password')
        .notEmpty().withMessage('Le mot de passe est requis'),
    handleValidationErrors
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty().withMessage('Le mot de passe actuel est requis'),
    body('newPassword')
        .notEmpty().withMessage('Le nouveau mot de passe est requis')
        .isLength({ min: LIMITS.PASSWORD_MIN_LENGTH })
        .withMessage(`Le mot de passe doit contenir au moins ${LIMITS.PASSWORD_MIN_LENGTH} caractères`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
    handleValidationErrors
];

// Validations pour les rapports
const createReportValidation = [
    body('template_id')
        .isInt({ min: 1 }).withMessage('ID du template invalide'),
    body('period_start')
        .isISO8601().withMessage('Date de début invalide')
        .toDate(),
    body('period_end')
        .isISO8601().withMessage('Date de fin invalide')
        .toDate()
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.period_start)) {
                throw new Error('La date de fin doit être après la date de début');
            }
            return true;
        }),
    body('data')
        .isObject().withMessage('Les données doivent être un objet')
        .custom((value) => {
            const dataSize = JSON.stringify(value).length;
            if (dataSize > LIMITS.MAX_REPORT_DATA_SIZE) {
                throw new Error('Les données du rapport sont trop volumineuses');
            }
            return true;
        }),
    handleValidationErrors
];

const updateReportValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID du rapport invalide'),
    body('data')
        .isObject().withMessage('Les données doivent être un objet'),
    handleValidationErrors
];

const validateReportValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID du rapport invalide'),
    body('status')
        .isIn(['valide', 'rejete']).withMessage('Statut invalide'),
    body('comments')
        .optional()
        .isString()
        .isLength({ max: 1000 }).withMessage('Commentaire trop long (max 1000 caractères)'),
    handleValidationErrors
];

// Validations pour les utilisateurs
const createUserValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Le nom d\'utilisateur est requis')
        .isLength({ min: LIMITS.USERNAME_MIN_LENGTH, max: LIMITS.USERNAME_MAX_LENGTH })
        .withMessage(`Le nom d'utilisateur doit contenir entre ${LIMITS.USERNAME_MIN_LENGTH} et ${LIMITS.USERNAME_MAX_LENGTH} caractères`)
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores'),
    body('email')
        .trim()
        .notEmpty().withMessage('L\'email est requis')
        .isEmail().withMessage('Email invalide')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Le mot de passe est requis')
        .isLength({ min: LIMITS.PASSWORD_MIN_LENGTH })
        .withMessage(`Le mot de passe doit contenir au moins ${LIMITS.PASSWORD_MIN_LENGTH} caractères`),
    body('full_name')
        .trim()
        .notEmpty().withMessage('Le nom complet est requis')
        .isLength({ min: 2, max: 100 })
        .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    body('department_id')
        .isInt({ min: 1, max: 10 }).withMessage('Département invalide'),
    body('role')
        .optional()
        .isIn(['admin', 'validateur', 'responsable']).withMessage('Rôle invalide'),
    handleValidationErrors
];

// Validations pour les paramètres de requête
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Numéro de page invalide')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limite invalide (max 100)')
        .toInt(),
    handleValidationErrors
];

// Validation des IDs dans les paramètres d'URL
const idParamValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID invalide'),
    handleValidationErrors
];

// Fonctions de validation personnalisées
const validators = {
    // Valider une période de dates
    isValidPeriod: (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, message: 'Dates invalides' };
        }

        if (end <= start) {
            return { valid: false, message: 'La date de fin doit être après la date de début' };
        }

        // Vérifier que la période n'est pas trop longue (ex: max 1 an)
        const diffDays = (end - start) / (1000 * 60 * 60 * 24);
        if (diffDays > 365) {
            return { valid: false, message: 'La période ne peut pas dépasser 1 an' };
        }

        return { valid: true };
    },

    // Valider un email
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Valider un mot de passe fort
    isStrongPassword: (password) => {
        if (password.length < LIMITS.PASSWORD_MIN_LENGTH) {
            return { valid: false, message: `Minimum ${LIMITS.PASSWORD_MIN_LENGTH} caractères` };
        }

        if (!/[a-z]/.test(password)) {
            return { valid: false, message: 'Au moins une lettre minuscule requise' };
        }

        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: 'Au moins une lettre majuscule requise' };
        }

        if (!/\d/.test(password)) {
            return { valid: false, message: 'Au moins un chiffre requis' };
        }

        return { valid: true };
    },

    // Valider un fichier
    isValidFile: (file) => {
        if (!file) {
            return { valid: false, message: 'Aucun fichier fourni' };
        }

        if (file.size > LIMITS.MAX_FILE_SIZE) {
            return {
                valid: false,
                message: `Fichier trop volumineux (max ${LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB)`
            };
        }

        return { valid: true };
    },

    // Nettoyer et valider les données JSON
    sanitizeJSON: (data) => {
        try {
            // Si c'est une string, parser
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            // Vérifier que c'est un objet
            if (typeof data !== 'object' || data === null) {
                throw new Error('Les données doivent être un objet');
            }

            return { valid: true, data };
        } catch (error) {
            return { valid: false, message: 'Format JSON invalide' };
        }
    }
};

module.exports = {
    // Middlewares de validation
    loginValidation,
    changePasswordValidation,
    createReportValidation,
    updateReportValidation,
    validateReportValidation,
    createUserValidation,
    paginationValidation,
    idParamValidation,
    handleValidationErrors,

    // Fonctions utilitaires
    validators
};