const config = require("../config/config");
const { HTTP_STATUS, ERROR_CODE } = require("../config/constants");
const logger = require("../utils/logger");

/**
 * ==========================================
 * ERROR HANDLING MIDDLEWARE
 * ==========================================
 */

/**
 * Custom Error Class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Handler
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route non trouvée: ${req.method} ${req.originalUrl}`,
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODE.NOT_FOUND,
  );
  next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error
  logger.error("Error:", {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
  });

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    error = new AppError(
      "Ressource non trouvée",
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODE.NOT_FOUND,
    );
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new AppError(
      `Le champ ${field} existe déjà`,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.DUPLICATE,
    );
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = new AppError(
      messages.join(", "),
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = new AppError(
      "Token invalide",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODE.UNAUTHORIZED,
    );
  }

  if (err.name === "TokenExpiredError") {
    error = new AppError(
      "Token expiré",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODE.UNAUTHORIZED,
    );
  }

  // PostgreSQL errors
  if (err.code === "23505") {
    // Unique violation
    error = new AppError(
      "Cette valeur existe déjà",
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.DUPLICATE,
    );
  }

  if (err.code === "23503") {
    // Foreign key violation
    error = new AppError(
      "Référence invalide",
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODE.BAD_REQUEST,
    );
  }

  if (err.code === "23502") {
    // Not null violation
    error = new AppError(
      "Champs obligatoires manquants",
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODE.VALIDATION_ERROR,
    );
  }

  // Multer errors (file upload)
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      error = new AppError(
        "Fichier trop volumineux",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODE.BAD_REQUEST,
      );
    } else {
      error = new AppError(
        "Erreur lors du téléchargement du fichier",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODE.BAD_REQUEST,
      );
    }
  }

  // Response
  res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
    success: false,
    message: error.message || "Erreur interne du serveur",
    errorCode: error.errorCode,
    ...(config.server.env === "development" && {
      stack: error.stack,
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
  notFound,
  errorHandler,
  asyncHandler,
};
