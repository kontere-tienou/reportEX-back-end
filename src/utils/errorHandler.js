const logger = require('../config/logger');
const { HTTP_STATUS } = require('../config/constants');

// Classe d'erreur personnalisée
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Erreurs spécifiques
class ValidationError extends AppError {
    constructor(message = 'Erreur de validation') {
        super(message, HTTP_STATUS.BAD_REQUEST);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Non authentifié') {
        super(message, HTTP_STATUS.UNAUTHORIZED);
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Non autorisé') {
        super(message, HTTP_STATUS.FORBIDDEN);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Ressource non trouvée') {
        super(message, HTTP_STATUS.NOT_FOUND);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflit de ressources') {
        super(message, HTTP_STATUS.CONFLICT);
    }
}

// Wrapper async pour éviter les try/catch répétitifs
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Handler global des erreurs (à utiliser comme middleware Express)
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;

    // Log de l'erreur
    if (error.statusCode >= 500) {
        logger.error({
            message: error.message,
            stack: err.stack,
            url: req.url,
            method: req.method,
            user: req.user?.id || 'anonymous',
            ip: req.ip
        });
    } else {
        logger.warn({
            message: error.message,
            url: req.url,
            method: req.method,
            user: req.user?.id || 'anonymous'
        });
    }

    // Erreurs PostgreSQL spécifiques
    if (err.code === '23505') {
        // Duplicate key
        error = new ConflictError('Cette entrée existe déjà');
    } else if (err.code === '23503') {
        // Foreign key violation
        error = new ValidationError('Référence invalide');
    } else if (err.code === '22P02') {
        // Invalid text representation
        error = new ValidationError('Format de données invalide');
    }

    // Erreurs JWT
    if (err.name === 'JsonWebTokenError') {
        error = new AuthenticationError('Token invalide');
    } else if (err.name === 'TokenExpiredError') {
        error = new AuthenticationError('Token expiré');
    }

    // Réponse
    res.status(error.statusCode).json({
        success: false,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            error: err
        })
    });
};

// Handler pour les routes non trouvées
const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} non trouvée`));
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    catchAsync,
    errorHandler,
    notFoundHandler
};