const config = require("../config/config");
const { HTTP_STATUS, ERROR_CODE } = require("../config/constants");
const logger = require("../utils/logger");

/**
 * ==========================================
 * ERROR HANDLING MIDDLEWARE
 * ==========================================
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable") {
    super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflit détecté") {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODE.DUPLICATE);
  }
}

class ValidationError extends AppError {
  constructor(message = "Données invalides") {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODE.VALIDATION_ERROR);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Accès interdit") {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODE.FORBIDDEN);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Non autorisé") {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.UNAUTHORIZED);
  }
}

/**
 * Helper validation période
 */
const isValidPeriod = (start, end) => {
  if (!start || !end) {
    return {
      valid: false,
      error: "Les dates de début et de fin sont obligatoires",
    };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      valid: false,
      error: "Format de date invalide",
    };
  }

  if (startDate > endDate) {
    return {
      valid: false,
      error: "La date de début doit être antérieure à la date de fin",
    };
  }

  return { valid: true };
};

/**
 * Not Found Handler
 */
const notFound = (req, res, next) => {
  const error = new NotFoundError(
    `Route non trouvée: ${req.method} ${req.originalUrl}`,
  );
  next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
  });

  if (err.name === "CastError") {
    error = new NotFoundError("Ressource non trouvée");
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new ConflictError(`Le champ ${field} existe déjà`);
  }

  if (err.name === "JsonWebTokenError") {
    error = new UnauthorizedError("Token invalide");
  }

  if (err.name === "TokenExpiredError") {
    error = new UnauthorizedError("Token expiré");
  }

  if (err.code === "23505") {
    error = new ConflictError("Cette valeur existe déjà");
  }

  if (err.code === "23503") {
    error = new ValidationError("Référence invalide");
  }

  if (err.code === "23502") {
    error = new ValidationError("Champs obligatoires manquants");
  }

  if (err.name === "MulterError") {
    error =
      err.code === "LIMIT_FILE_SIZE"
        ? new ValidationError("Fichier trop volumineux")
        : new ValidationError("Erreur lors du téléchargement du fichier");
  }

  res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    message: error.message || "Erreur interne du serveur",
    errorCode: error.errorCode || ERROR_CODE.INTERNAL_ERROR,
    ...(config.server.env === "development" && {
      stack: err.stack,
      error: err,
    }),
  });
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  UnauthorizedError,
  isValidPeriod,
  notFound,
  errorHandler,
  asyncHandler,
};
